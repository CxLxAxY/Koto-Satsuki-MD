import { createWriteStream } from 'node:fs';
import { mkdtemp, open, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { ConcurrencyLimiter } from './concurrencyLimiter.js';
import { requestPublicUrl } from './publicHttp.js';
import { ScraperError } from './scraperError.js';
import { UrlValidationError, parseHttpUrl } from './urlValidator.js';
import logger from '../../utils/logger.js';

const mimeExtensions = {
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/flac': '.flac',
  'audio/webm': '.webm',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
};

const sanitizeFileName = (value, mimeType) => {
  const cleaned = String(value || 'media')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, '_')
    .replace(/^\.+/u, '')
    .trim()
    .slice(0, 100);
  const name = cleaned || 'media';
  return extname(name)
    ? name
    : `${name}${mimeExtensions[mimeType] || '.bin'}`;
};

const expectedCategory = (value) => {
  const type = String(value || '').toLowerCase();
  if (/audio|mp3|m4a|sound/u.test(type)) return 'audio';
  if (/image|photo|picture/u.test(type)) return 'image';
  if (/video|mp4|webm/u.test(type)) return 'video';
  return undefined;
};

const detectMimeType = (header, expectedType) => {
  const expected = expectedCategory(expectedType);
  if (header.length >= 12 && header.toString('ascii', 4, 8) === 'ftyp') {
    return expected === 'audio' ? 'audio/mp4' : 'video/mp4';
  }
  if (header.length >= 12 && header.toString('ascii', 0, 4) === 'RIFF') {
    if (header.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    if (header.toString('ascii', 8, 12) === 'WAVE') return 'audio/wav';
  }
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png';
  }
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'image/jpeg';
  }
  if (header.length >= 6 && /^GIF8[79]a$/u.test(header.toString('ascii', 0, 6))) {
    return 'image/gif';
  }
  if (header.length >= 4 && header.toString('ascii', 0, 4) === 'OggS') {
    return 'audio/ogg';
  }
  if (header.length >= 4 && header.toString('ascii', 0, 4) === 'fLaC') {
    return 'audio/flac';
  }
  if (header.length >= 3 && header.toString('ascii', 0, 3) === 'ID3') {
    return 'audio/mpeg';
  }
  if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  if (header.length >= 4 && header.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  if (header.length >= 4 && header.readUInt32LE(0) === 0x04034b50) {
    return 'application/zip';
  }
  if (header.length >= 4 && header.readUInt32BE(0) === 0x1a45dfa3) {
    return expected === 'audio' ? 'audio/webm' : 'video/webm';
  }
  return undefined;
};

const getHeaderBytes = async (path) => {
  const file = await open(path, 'r');
  try {
    const header = Buffer.alloc(32);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return header.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
};

class DownloadManager {
  constructor({
    maxBytes = 15 * 1024 * 1024,
    maxConcurrent = 2,
    maxQueue = 8,
    maxRedirects = 3,
    timeoutMs = 30000,
    tempRoot = tmpdir(),
    lookup,
    request = requestPublicUrl,
  } = {}) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
      throw new TypeError('maxBytes must be a positive safe integer.');
    }
    if (!Number.isInteger(maxRedirects) || maxRedirects < 0) {
      throw new TypeError('maxRedirects must be a non-negative integer.');
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
      throw new TypeError('timeoutMs must be a positive number.');
    }
    this.maxBytes = maxBytes;
    this.maxRedirects = maxRedirects;
    this.timeoutMs = timeoutMs;
    this.tempRoot = tempRoot;
    this.lookup = lookup;
    this.request = request;
    this.limiter = new ConcurrencyLimiter({ maxConcurrent, maxQueue });
  }

  async withDownloadedFile(url, options, send) {
    return this.limiter.run(async () => {
      const directory = await mkdtemp(join(this.tempRoot, 'koto-scraper-'));
      const path = join(directory, `${randomUUID()}.bin`);
      try {
        const file = await this.#download(url, path, options);
        return await send(file);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
  }

  async #download(value, path, options = {}) {
    if (Buffer.isBuffer(value)) {
      if (value.length === 0 || value.length > this.maxBytes) {
        throw new ScraperError(
          value.length > this.maxBytes ? 'DOWNLOAD_TOO_LARGE' : 'UNSUPPORTED_MEDIA',
        );
      }
      try {
        await writeFile(path, value, { flag: 'wx', mode: 0o600 });
      } catch {
        throw new ScraperError('DOWNLOAD_FAILED');
      }
      return this.#inspectFile(path, options);
    }

    const stream =
      value instanceof Readable
        ? value
        : value && typeof value === 'object' && value.stream instanceof Readable
          ? value.stream
          : undefined;
    if (stream) {
      await this.#writeStream(stream, path);
      return this.#inspectFile(path, options);
    }

    let currentUrl = value;
    let response;
    for (let redirectCount = 0; redirectCount <= this.maxRedirects; redirectCount += 1) {
      try {
        const parsed = parseHttpUrl(
          currentUrl instanceof URL ? currentUrl.href : currentUrl,
        );
        if (parsed.url.protocol !== 'https:') {
          throw new ScraperError('INVALID_URL');
        }
        ({ response, url: currentUrl } = await this.request(currentUrl, {
          lookup: this.lookup,
          timeoutMs: this.timeoutMs,
        }));
      } catch (error) {
        if (error instanceof ScraperError) {
          throw error;
        }
        if (error?.message === 'PUBLIC_REQUEST_TIMEOUT') {
          throw new ScraperError('TIMEOUT');
        }
        if (error instanceof UrlValidationError) {
          throw new ScraperError(error.code);
        }
        throw new ScraperError('DOWNLOAD_FAILED');
      }

      if (
        !(response instanceof Readable) ||
        !response.headers ||
        typeof response.headers !== 'object'
      ) {
        response?.destroy?.();
        throw new ScraperError('DOWNLOAD_FAILED');
      }
      const status = Number(response.statusCode);
      if (!Number.isInteger(status)) {
        response.destroy();
        throw new ScraperError('DOWNLOAD_FAILED');
      }
      if (status >= 300 && status < 400 && response.headers.location) {
        response.destroy();
        if (redirectCount === this.maxRedirects) {
          throw new ScraperError('DOWNLOAD_FAILED');
        }
        try {
          currentUrl = new URL(response.headers.location, currentUrl).href;
        } catch {
          throw new ScraperError('INVALID_URL');
        }
        continue;
      }
      if (status < 200 || status >= 300) {
        response.destroy();
        throw new ScraperError(status === 429 ? 'RATE_LIMITED' : 'DOWNLOAD_FAILED');
      }

      const contentType = String(response.headers['content-type'] || '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      const length = Number(response.headers['content-length']);
      if (Number.isFinite(length) && length > this.maxBytes) {
        response.destroy();
        throw new ScraperError('DOWNLOAD_TOO_LARGE');
      }
      if (contentType.startsWith('text/') || contentType.includes('html')) {
        response.destroy();
        throw new ScraperError('UNSUPPORTED_MEDIA');
      }

      try {
        await this.#writeStream(response, path);
      } catch (error) {
        if (error?.message === 'PUBLIC_REQUEST_TIMEOUT') {
          throw new ScraperError('TIMEOUT');
        }
        throw error;
      }

      return this.#inspectFile(path, {
        ...options,
        contentType,
        sourceUrl: currentUrl.href,
        fallbackName: currentUrl.pathname.split('/').pop(),
      });
    }

    throw new ScraperError('DOWNLOAD_FAILED');
  }

  async #writeStream(stream, path) {
    if (!(stream instanceof Readable)) {
      throw new ScraperError('UNSUPPORTED_MEDIA');
    }
    let totalBytes = 0;
    const byteLimit = new Transform({
      transform: (chunk, encoding, callback) => {
        totalBytes += chunk.length;
        if (totalBytes > this.maxBytes) {
          callback(new ScraperError('DOWNLOAD_TOO_LARGE'));
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(
        stream,
        byteLimit,
        createWriteStream(path, { flags: 'wx', mode: 0o600 }),
      );
    } catch (error) {
      if (error instanceof ScraperError) {
        throw error;
      }
      if (error?.message === 'PUBLIC_REQUEST_TIMEOUT') {
        throw new ScraperError('TIMEOUT');
      }
      throw new ScraperError('DOWNLOAD_FAILED');
    }
  }

  async #inspectFile(path, options = {}) {
    let fileStats;
    try {
      fileStats = await stat(path);
    } catch {
      throw new ScraperError('DOWNLOAD_FAILED');
    }
    if (!fileStats.isFile() || fileStats.size === 0) {
      throw new ScraperError('UNSUPPORTED_MEDIA');
    }
    if (fileStats.size > this.maxBytes) {
      throw new ScraperError('DOWNLOAD_TOO_LARGE');
    }

    let bytes;
    try {
      bytes = await getHeaderBytes(path);
    } catch {
      throw new ScraperError('DOWNLOAD_FAILED');
    }
    const mimeType = detectMimeType(bytes, options.expectedType);
    if (
      !mimeType ||
      (options.contentType &&
        options.contentType !== 'application/octet-stream' &&
        options.contentType !== mimeType)
    ) {
      throw new ScraperError('UNSUPPORTED_MEDIA');
    }
    const expected = expectedCategory(options.expectedType);
    if (expected && !mimeType.startsWith(`${expected}/`)) {
      throw new ScraperError('UNSUPPORTED_MEDIA');
    }
    const file = {
      path,
      mimeType,
      mediaKind: mimeType.startsWith('application/') ? 'document' : mimeType.split('/')[0],
      fileName: sanitizeFileName(
        options.fileName || options.fallbackName,
        mimeType,
      ),
      size: fileStats.size,
      ...(options.sourceUrl ? { url: options.sourceUrl } : {}),
    };
    logger.debug(
      `Downloader media validated: kind=${file.mediaKind} mime=${file.mimeType} size=${file.size} local_file=true`,
    );
    return file;
  }
}

export { DownloadManager, detectMimeType, sanitizeFileName };
