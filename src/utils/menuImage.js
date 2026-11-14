import { access, readFile, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename } from 'node:path';
import config from '../config/config.js';

let cachedImage;
let pendingLoad;

const detectImageMimeType = (buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
};

const readMenuImage = async (imagePath) => {
  await access(imagePath, constants.R_OK);
  const metadata = await stat(imagePath);
  if (!metadata.isFile() || metadata.size === 0) {
    throw new Error('the configured path is not a non-empty image file');
  }

  const buffer = await readFile(imagePath);
  const mimeType = detectImageMimeType(buffer);
  if (!mimeType) {
    throw new Error('the configured file is not a supported JPEG, PNG, or WebP image');
  }

  return {
    buffer,
    fileName: basename(imagePath),
    mimeType,
    path: imagePath,
  };
};

const loadMenuImage = async (imagePath = config.menu.imagePath) => {
  if (cachedImage?.path === imagePath) {
    return cachedImage;
  }
  if (pendingLoad?.path === imagePath) {
    return pendingLoad.promise;
  }

  const promise = readMenuImage(imagePath);
  pendingLoad = { path: imagePath, promise };
  try {
    const image = await promise;
    cachedImage = image;
    return image;
  } catch (error) {
    const imageError = new Error(
      `Menu image "${basename(imagePath)}" could not be loaded: ${error.message}`,
      {
      cause: error,
      },
    );
    imageError.code = 'MENU_IMAGE_UNAVAILABLE';
    throw imageError;
  } finally {
    if (pendingLoad?.promise === promise) {
      pendingLoad = undefined;
    }
  }
};

export { detectImageMimeType, loadMenuImage };
