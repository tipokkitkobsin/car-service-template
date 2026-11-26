// Reads and writes one JSON file through the GitHub Contents API.
import { t } from './i18n.js';
import { carIdFromFile, carPath, MAIN_CAR } from './garage.js';

const API = 'https://api.github.com';
const MAX_ATTEMPTS = 3;
const CHUNK_SIZE = 32768;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StoreError';
    this.code = code;
  }
}

export const encodeJson = (value) => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  let binary = '';
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(start, start + CHUNK_SIZE));
  }
  return btoa(binary);
};

export const decodeJson = (base64) => {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};

const errorFor = (status) => {
  if (status === 401 || status === 403) return new StoreError('auth', t('GitHub token ใช้ไม่ได้ หรือไม่มีสิทธิ์ใน repo ข้อมูล'));
  if (status === 404) return new StoreError('missing', t('ไม่พบไฟล์ข้อมูล หรือ token มองไม่เห็น repo ข้อมูล'));
  if (status === 409) return new StoreError('conflict', t('ข้อมูลถูกแก้จากที่อื่นพร้อมกัน ลองใหม่อีกครั้ง'));
  return new StoreError('server', t('GitHub ตอบกลับผิดพลาด ({status})', { status }));
};

export const createStore = ({ owner, repo, path, token, fetchFn = (...args) => fetch(...args) }) => {
  const repoUrl = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const url = `${repoUrl}/contents/${path}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const request = async (target, options) => {
    let response;
    try {
      response = await fetchFn(target, { cache: 'no-store', ...options, headers });
    } catch {
      throw new StoreError('network', t('เชื่อมต่อ GitHub ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'));
    }
    if (!response.ok) throw errorFor(response.status);
    return response.json();
  };

  const load = async () => {
    const body = await request(url, { method: 'GET' });
    if (!body.content) throw new StoreError('server', t('ไฟล์ข้อมูลอ่านไม่ได้'));
    return { data: decodeJson(body.content), sha: body.sha };
  };

  const save = async (data, sha, message) => {
    const body = await request(url, {
      method: 'PUT',
      body: JSON.stringify({ message, content: encodeJson(data), sha }),
    });
    return { data, sha: body.content.sha };
  };

  // Writes the file for the first time, in an empty data repo.
  const create = async (data, message) => save(data, undefined, message);

  // 'private', 'public', or 'missing' (repo missing or not shared with the token).
  const repoStatus = async () => {
    try {
      const body = await request(repoUrl, { method: 'GET' });
      return body.private === true ? 'private' : 'public';
    } catch (error) {
      if (error.code === 'missing') return 'missing';
      throw error;
    }
  };

  const update = async (change, message) => {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const current = await load();
      try {
        return await save(change(current.data), current.sha, message);
      } catch (error) {
        if (error.code !== 'conflict' || attempt === MAX_ATTEMPTS) throw error;
      }
    }
    throw new StoreError('conflict', t('ข้อมูลถูกแก้จากที่อื่นพร้อมกัน ลองใหม่อีกครั้ง'));
  };

  const listFolder = async (folder) => {
    const body = await request(`${repoUrl}/contents/${folder}`, { method: 'GET' });
    return Array.isArray(body) ? body : [];
  };

  const remove = async (message) => {
    const { sha } = await load();
    await request(url, { method: 'DELETE', body: JSON.stringify({ message, sha }) });
  };

  return { load, save, create, remove, listFolder, repoStatus, update };
};

// All cars in one data repo. Each car is its own file, so each has its own store.
export const createGarage = ({ owner, repo, token, fetchFn }) => {
  const storeFor = (id) => createStore({ owner, repo, path: carPath(id), token, fetchFn });
  const listCars = async () => {
    try {
      const entries = await storeFor(MAIN_CAR).listFolder('data');
      return entries.filter((entry) => entry.type === 'file').map((entry) => carIdFromFile(entry.name)).filter(Boolean)
        .sort((a, b) => (a === MAIN_CAR ? -1 : b === MAIN_CAR ? 1 : a.localeCompare(b)));
    } catch (error) {
      if (error.code === 'missing') return [];
      throw error;
    }
  };
  return { listCars, storeFor };
};
