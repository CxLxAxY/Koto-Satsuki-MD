import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapePinterestDirect } from './methods/direct.js';
import { scrapePindown } from './methods/pindown.js';

const hosts = ['pinterest.com', 'pin.it'];
const fallbackMethods = [
  ['direct', scrapePinterestDirect],
  ['pindown', scrapePindown],
];

const scrapePinterest = async (value, { lookup, methods: overrides = {} } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  let lastError;
  let temporaryError;
  for (const [methodName, defaultMethod] of fallbackMethods) {
    try {
      const response = await (overrides[methodName] || defaultMethod)(url);
      const result = response.result;
      const candidates = Array.isArray(result?.downloads)
        ? result.downloads
        : result?.url
          ? [result]
          : [];
      const downloads = candidates.filter((item) => {
        if (!item || typeof item.url !== 'string') return false;
        try {
          return new URL(item.url).protocol === 'https:';
        } catch {
          return false;
        }
      });
      if (downloads.length === 0) throw new ScraperError('UPSTREAM_FAILED');
      return {
        success: true,
        provider: 'pinterest',
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
        logger.media(`[SCRAPER:PINTEREST] Fallback after method=${methodName} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

export { scrapePinterest };
