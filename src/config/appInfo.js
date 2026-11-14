import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const appPackagePath = fileURLToPath(new URL('../../package.json', import.meta.url));
const baileysPackagePath = fileURLToPath(
  new URL('../../node_modules/@whiskeysockets/baileys/package.json', import.meta.url),
);

let packageMetadataPromise;

const getPackageMetadata = () => {
  if (!packageMetadataPromise) {
    packageMetadataPromise = Promise.all([
      readFile(appPackagePath, 'utf8').then(JSON.parse),
      readFile(baileysPackagePath, 'utf8').then(JSON.parse),
    ])
      .then(([application, baileys]) => ({ application, baileys }))
      .catch((error) => {
        packageMetadataPromise = undefined;
        throw new Error('Failed to read application or Baileys package metadata.', { cause: error });
      });
  }

  return packageMetadataPromise;
};

export { getPackageMetadata };
export default getPackageMetadata;
