import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeInstagramDirect } from './methods/direct.js';
import { scrapeIndown } from './methods/indown.js';
import { scrapeInstagramSnapsave } from './methods/snapsave.js';
import { scrapeSnapinsta } from './methods/snapinsta.js';

const hosts = ['instagram.com', 'instagr.am'];
const fallbackMethods = [
  ['direct', scrapeInstagramDirect],
  ['indown', scrapeIndown],
  ['snapsave', scrapeInstagramSnapsave],
  ['snapinsta', scrapeSnapinsta],
];

const getDownloads = (result) => {
  const items = Array.isArray(result?.downloads) ? result.downloads : result?.url ? [result] : [];
  const seen = new Set();
  return items.filter((item) => {
    if (!item || typeof item.url !== 'string' || seen.has(item.url)) return false;
    try {
      if (new URL(item.url).protocol !== 'https:') return false;
    } catch {
      return false;
    }
    seen.add(item.url);
    return true;
  });
};

const scrapeInstagram = async (value, { lookup, methods: overrides = {} } = {}) => {
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
        provider: 'instagram',
        method: methodName,
        title: result.title,
        thumbnail: result.thumbnail,
        type: result.type,
        downloads,
        result,
      };
    } catch (error) {
      lastError = error;
      if (['RATE_LIMITED', 'TIMEOUT'].includes(error?.code)) temporaryError = error;
      if (methodName !== fallbackMethods.at(-1)[0]) {
        logger.media(`[SCRAPER:INSTAGRAM] Fallback after method=${methodName} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

export { scrapeInstagram };
