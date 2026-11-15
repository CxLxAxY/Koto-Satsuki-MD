import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeSpotisaver } from './methods/spotisaver.js';
import { scrapeSpotidown } from './methods/spotidown.js';
import { scrapeSpotmate } from './methods/spotmate.js';
import { scrapeSoundloaders } from './methods/soundloaders.js';

const hosts = ['spotify.com', 'spotify.link'];
const fallbackMethods = [
  ['spotisaver', scrapeSpotisaver],
  ['spotidown', scrapeSpotidown],
  ['spotmate', scrapeSpotmate],
  ['soundloaders', scrapeSoundloaders],
];

const getDownloads = (result) => {
  const items = Array.isArray(result?.downloads) ? result.downloads : result?.url ? [result] : [];
  return items.filter((item) => {
    if (!item || typeof item.url !== 'string') return false;
    try {
      return new URL(item.url).protocol === 'https:';
    } catch {
      return false;
    }
  });
};

const scrapeSpotify = async (value, { lookup, methods: overrides = {} } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  let lastError;
  let temporaryError;
  for (const [methodName, defaultMethod] of fallbackMethods) {
    try {
      const response = await (overrides[methodName] || defaultMethod)(url);
      const result = response.result;
      const downloads = getDownloads(result);
      if (downloads.length === 0) throw new ScraperError('UPSTREAM_FAILED');
      return {
        success: true,
        provider: 'spotify',
        method: methodName,
        title: result.title,
        thumbnail: result.thumbnail,
        type: result.type,
        downloads,
        tracks: Array.isArray(result.tracks) ? result.tracks : [],
        result,
      };
    } catch (error) {
      lastError = error;
      if (['RATE_LIMITED', 'TIMEOUT'].includes(error?.code)) temporaryError = error;
      if (methodName !== fallbackMethods.at(-1)[0]) {
        logger.media(`[SCRAPER:SPOTIFY] Fallback after method=${methodName} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

export { scrapeSpotify };
