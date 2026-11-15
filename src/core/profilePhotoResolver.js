import logger from '../utils/logger.js';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_MAX_CACHE_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const isParticipantJid = (jid) =>
  typeof jid === 'string' &&
  /^(?:[^@\s]+)@(?:s\.whatsapp\.net|lid)$/u.test(jid);

const hasImageSignature = (buffer, mimeType) => {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  }
  return (
    mimeType === 'image/webp' &&
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
};

const validateProfileUrl = (value) => {
  let url;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error('Baileys returned an invalid profile photo URL.', { cause });
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.href.length > 4096 ||
    !/(?:^|\.)whatsapp\.net$/u.test(url.hostname)
  ) {
    throw new Error('Baileys returned a profile photo URL outside the official WhatsApp domain.');
  }
  return url.href;
};

class ProfilePhotoResolver {
  constructor({
    fetchImpl = globalThis.fetch,
    appLogger = logger,
    now = Date.now,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    ttlMs = DEFAULT_TTL_MS,
    maxEntries = DEFAULT_MAX_ENTRIES,
    maxCacheBytes = DEFAULT_MAX_CACHE_BYTES,
    maxImageBytes = DEFAULT_MAX_IMAGE_BYTES,
  } = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new TypeError('ProfilePhotoResolver requires the Node.js fetch API.');
    }
    this.fetchImpl = fetchImpl;
    this.logger = appLogger;
    this.now = now;
    this.timeoutMs = timeoutMs;
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.maxCacheBytes = maxCacheBytes;
    this.maxImageBytes = maxImageBytes;
    this.cache = new Map();
    this.cacheBytes = 0;
    this.inFlight = new Map();
  }

  async resolve(socket, groupJid, participantJid, {
    refresh = false,
    resolveParticipant,
  } = {}) {
    if (!/^[^@\s]+@g\.us$/u.test(groupJid || '') || !isParticipantJid(participantJid)) {
      throw new TypeError('Profile photo lookup requires a group JID and participant JID.');
    }
    this.pruneExpired();
    const key = `${groupJid}\u0000${participantJid}`;
    const cached = this.getCached(key);
    if (cached && !refresh) {
      return cached;
    }
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const lookup = this.fetchAndCache(
      socket,
      key,
      participantJid,
      cached,
      resolveParticipant,
    );
    this.inFlight.set(key, lookup);
    try {
      return await lookup;
    } finally {
      if (this.inFlight.get(key) === lookup) {
        this.inFlight.delete(key);
      }
    }
  }

  async fetchAndCache(socket, key, participantJid, cached, resolveParticipant) {
    try {
      if (typeof socket?.profilePictureUrl !== 'function') {
        throw new Error('Baileys profilePictureUrl is unavailable.');
      }
      const resolution =
        typeof resolveParticipant === 'function'
          ? resolveParticipant(participantJid)
          : undefined;
      const participantForLookup =
        resolution?.resolved && /^\d{8,15}$/u.test(resolution.phoneNumber)
          ? `${resolution.phoneNumber}@s.whatsapp.net`
          : participantJid;
      const profileUrl = await socket.profilePictureUrl(
        participantForLookup,
        'image',
        this.timeoutMs,
      );
      if (!profileUrl) {
        return cached || null;
      }
      const image = await this.downloadImage(profileUrl);
      this.setCached(key, image);
      return image;
    } catch (error) {
      this.logger.warning(`Profile photo unavailable; using ${cached ? 'cached image' : 'text fallback'}.`);
      const errorName =
        error && typeof error.name === 'string' ? error.name : 'UnknownError';
      this.logger.debug(`Profile photo lookup failed (${errorName}).`);
      return cached || null;
    }
  }

  async downloadImage(profileUrl) {
    const url = validateProfileUrl(profileUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    timeout.unref?.();
    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal,
        headers: { accept: 'image/jpeg,image/png,image/webp' },
      });
      if (!response.ok) {
        throw new Error(`Profile photo request returned HTTP ${response.status}.`);
      }
      const mimeType = (response.headers.get('content-type') || '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
      if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
        throw new Error('Profile photo response has an unsupported MIME type.');
      }
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > this.maxImageBytes) {
        throw new Error('Profile photo exceeds the configured image size limit.');
      }
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('Profile photo response has no readable body.');
      }

      const reader = response.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          const chunk = Buffer.from(value);
          totalBytes += chunk.length;
          if (totalBytes > this.maxImageBytes) {
            await reader.cancel();
            throw new Error('Profile photo exceeds the configured image size limit.');
          }
          chunks.push(chunk);
        }
      } finally {
        reader.releaseLock();
      }

      const buffer = Buffer.concat(chunks, totalBytes);
      if (!hasImageSignature(buffer, mimeType)) {
        throw new Error('Profile photo content does not match its MIME type.');
      }
      return { buffer, mimeType, size: totalBytes };
    } finally {
      clearTimeout(timeout);
    }
  }

  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= this.now()) {
      this.removeCached(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return { buffer: entry.buffer, mimeType: entry.mimeType, size: entry.size };
  }

  setCached(key, image) {
    if (
      image.size > this.maxImageBytes ||
      image.size > this.maxCacheBytes ||
      this.maxEntries < 1
    ) {
      return;
    }
    this.pruneExpired();
    this.removeCached(key);
    while (
      this.cache.size >= this.maxEntries ||
      this.cacheBytes + image.size > this.maxCacheBytes
    ) {
      const oldest = this.cache.keys().next().value;
      if (!oldest) {
        break;
      }
      this.removeCached(oldest);
    }
    const entry = {
      buffer: image.buffer,
      mimeType: image.mimeType,
      size: image.size,
      expiresAt: this.now() + this.ttlMs,
    };
    this.cache.set(key, entry);
    this.cacheBytes += entry.size;
  }

  removeCached(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cacheBytes -= entry.size;
      this.cache.delete(key);
    }
  }

  pruneExpired() {
    const now = this.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.removeCached(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.cacheBytes = 0;
  }
}

const createProfilePhotoResolver = (options = {}) =>
  new ProfilePhotoResolver(options);

export {
  DEFAULT_MAX_CACHE_BYTES,
  DEFAULT_MAX_ENTRIES,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_TTL_MS,
  ProfilePhotoResolver,
  createProfilePhotoResolver,
};
