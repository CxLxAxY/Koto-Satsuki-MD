import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['music.apple.com', 'apple.co'];

const scrapeAppleMusic = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const response = await invokeUpstream({
    provider: 'applemusic',
    methodName: 'aplmate',
    method: library.applemusic?.aplmate,
    args: [url],
  });
  const result = response.result;
  const candidates = Array.isArray(result?.downloads) ? result.downloads : result?.url ? [result] : [];
  const downloads = candidates.filter((item) => {
        try {
          return typeof item?.url === 'string' && new URL(item.url).protocol === 'https:';
        } catch {
          return false;
        }
      })
  if (!downloads.length) throw new ScraperError('UPSTREAM_FAILED');
  return {
    success: true,
    provider: 'applemusic',
    method: 'aplmate',
    title: result.title,
    thumbnail: result.thumbnail,
    type: result.type || 'audio',
    downloads,
    result,
  };
};

export { scrapeAppleMusic };
