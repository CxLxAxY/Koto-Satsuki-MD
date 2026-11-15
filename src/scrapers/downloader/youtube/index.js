import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeYtmp3 } from './methods/ytmp3.js';
import { scrapeYtmp3gg } from './methods/ytmp3gg.js';
import { scrapeYoutubePlaylist as runPlaylist } from './methods/playlist.js';

const hosts = ['youtube.com', 'youtu.be'];
const videoHosts = ['youtube.com', 'youtu.be'];

const getFormatDownloads = (result, format) => {
  const items = Array.isArray(result?.downloads) ? result.downloads : result?.url ? [result] : [];
  const desiredType = format === 'mp3' ? 'audio' : 'video';
  return items.filter((item) => {
    if (!item || typeof item.url !== 'string') return false;
    try {
      if (new URL(item.url).protocol !== 'https:') return false;
    } catch {
      return false;
    }
    const type = String(item.type || result.type || '').toLowerCase();
    return type === desiredType || type.startsWith(`${desiredType}/`);
  });
};

const scrapeYoutubeFormat = async (
  value,
  format,
  { lookup, methods: overrides = {} } = {},
) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const fallbackMethods = [
    ['ytmp3', (input) => (overrides.ytmp3 || scrapeYtmp3)(input, format)],
    [
      'ytmp3gg',
      (input) =>
        (overrides.ytmp3gg || scrapeYtmp3gg)(input, {
          format,
          ...(format === 'mp4' ? { quality: '720p' } : {}),
        }),
    ],
  ];
  let lastError;
  let temporaryError;
  for (const [methodName, runMethod] of fallbackMethods) {
    try {
      const response = await runMethod(url);
      const result = response.result;
      const downloads = getFormatDownloads(result, format);
      if (downloads.length === 0) throw new ScraperError('UPSTREAM_FAILED');
      return {
        success: true,
        provider: 'youtube',
        method: methodName,
        title: result.title,
        thumbnail: result.thumbnail,
        type: format === 'mp3' ? 'audio' : 'video',
        downloads,
        result,
      };
    } catch (error) {
      lastError = error;
      if (['RATE_LIMITED', 'TIMEOUT'].includes(error?.code)) temporaryError = error;
      if (methodName !== fallbackMethods.at(-1)[0]) {
        logger.media(`[SCRAPER:YOUTUBE] Fallback after method=${methodName} format=${format} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

const scrapeYoutubeAudio = (url, options) => scrapeYoutubeFormat(url, 'mp3', options);
const scrapeYoutubeVideo = (url, options) => scrapeYoutubeFormat(url, 'mp4', options);

const scrapeYoutubePlaylist = async (value, { lookup, method = runPlaylist } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const response = await method(url);
  const result = response.result;
  const items = Array.isArray(result?.items)
    ? result.items.filter((item) => {
        if (!item || typeof item.title !== 'string' || typeof item.url !== 'string') return false;
        try {
          const parsed = new URL(item.url);
          return (
            parsed.protocol === 'https:' &&
            videoHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
          );
        } catch {
          return false;
        }
      })
    : [];
  if (items.length === 0) throw new ScraperError('NO_RESULTS');
  return {
    success: true,
    provider: 'youtube',
    method: 'playlist',
    title: result.title,
    thumbnail: result.thumbnail,
    type: 'playlist',
    items,
    result,
  };
};

export { scrapeYoutubeAudio, scrapeYoutubePlaylist, scrapeYoutubeVideo };
