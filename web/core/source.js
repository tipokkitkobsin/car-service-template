// Which GitHub repo holds the car data. Nothing here is secret.
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const PAGES_SUFFIX = '.github.io';
export const DEFAULT_REPO = 'car-service-data';
export const DATA_PATH = 'data/car.json';

export const defaultSource = (host) => ({
  owner: host.endsWith(PAGES_SUFFIX) ? host.slice(0, -PAGES_SUFFIX.length).split('.')[0] : '',
  repo: DEFAULT_REPO,
});

export const sourceErrors = ({ owner, repo }) => [
  ...(OWNER_PATTERN.test(owner ?? '') ? [] : ['ชื่อบัญชี GitHub ไม่ถูกต้อง']),
  ...(REPO_PATTERN.test(repo ?? '') && !/^\.+$/.test(repo) && !repo.includes('..') ? [] : ['ชื่อ repo ข้อมูลไม่ถูกต้อง']),
];
