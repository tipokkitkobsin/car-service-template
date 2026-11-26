// Reads a JSON file that may not exist yet (a new data repo has no state, or no car before setup).
export const readJson = async (readText, fallback) => {
  try {
    return JSON.parse(await readText());
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};
