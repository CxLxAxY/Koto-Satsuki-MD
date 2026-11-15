import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeFacebookSnapsave } from './methods/snapsave.js';
import { scrapeFdown } from './methods/fdown.js';

const hosts = ['facebook.com', 'fb.watch', 'fb.com'];
const fallbackMethods = [
  ['snapsave', scrapeFacebookSnapsave],
  ['fdown', scrapeFdown],
];

const scrapeFacebook = async (value, { lookup, methods: overrides = {} } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  let lastError;
  let temporaryError;
  for (const [methodName, defaultMethod] of fallbackMethods) {
    try {
      const response = await (overrides[methodName] || defaultMethod)(url);
      const result = response.result;
      const downloads = Array.isArray(result?.downloads)
        ? result.downloads.filter((item) => {
            if (!item || typeof item.url !== 'string') return false;
            try {
              return new URL(item.url).protocol === 'https:';
            } catch {
              return false;
            }
          })
        : result?.url && new URL(result.url).protocol === 'https:'
          ? [result]
          : [];
      if (downloads.length === 0) throw new ScraperError('UPSTREAM_FAILED');
      return {
        success: true,
        provider: 'facebook',
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
        logger.media(`[SCRAPER:FACEBOOK] Fallback after method=${methodName} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

export { scrapeFacebook };
