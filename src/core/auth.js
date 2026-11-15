import { useMultiFileAuthState } from '@whiskeysockets/baileys';
import { chmod, mkdir, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const secureAuthFiles = async (folder) => {
  if (process.platform === 'win32') {
    return;
  }

  await chmod(folder, 0o700);
  const entries = await readdir(folder, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => chmod(join(folder, entry.name), 0o600)),
  );
};

const validateAuthFiles = async (folder) => {
  const entries = await readdir(folder, { withFileTypes: true });
  const authFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'));

  await Promise.all(
    authFiles.map(async (entry) => {
      try {
        const content = await readFile(join(folder, entry.name), 'utf8');
        const data = JSON.parse(content);
        if (
          entry.name === 'creds.json' &&
          (!data || typeof data !== 'object' || typeof data.registered !== 'boolean')
        ) {
          throw new Error('credentials have an invalid structure');
        }
      } catch (error) {
        throw new Error(
          `Authentication file "${entry.name}" is unreadable or corrupted. Review or restore the auth session manually.`,
          { cause: error },
        );
      }
    }),
  );
};

const getAuthState = async (folder) => {
  await mkdir(folder, { recursive: true, mode: 0o700 });
  await secureAuthFiles(folder);
  await validateAuthFiles(folder);

  const authState = await useMultiFileAuthState(folder);
  return {
    ...authState,
    saveCreds: async () => {
      await authState.saveCreds();
      await secureAuthFiles(folder);
    },
  };
};

const createAuthState = getAuthState;

export { createAuthState, getAuthState };
export default {
  createAuthState,
  getAuthState,
};


