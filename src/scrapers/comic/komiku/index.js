import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['komiku.org'];
const entryFor = (library) => library.comic?.komiku;
const normalizeItems = (items) =>
  items.flatMap((item) => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || !isAgeAppropriateContent(item)) return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return [];
      return [{ title: item.title.trim().slice(0, 180), url: url.href, provider: 'komiku' }];
    } catch { return []; }
  }).filter((item) => item.title);

const scrapeKomiku = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = entryFor(library);
  const response = await invokeUpstream({ provider: 'komiku', methodName: 'scrape', method: entry?.scrape || entry, args: [url] });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return { provider: 'komiku', sourceUrl: url, title: result.title || result.name, author: result.author, thumbnail: result.thumbnail, type: result.type };
};
const searchKomiku = async (query, { library = scrapr } = {}) => {
  const response = await invokeUpstream({ provider: 'komiku', methodName: 'search', method: entryFor(library)?.search, args: [query] });
  return normalizeItems(Array.isArray(response.result) ? response.result : []);
};
const getKomikuChapters = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = entryFor(library);
  const metadata = await invokeUpstream({ provider: 'komiku', methodName: 'scrape', method: entry?.scrape || entry, args: [url] });
  if (!isAgeAppropriateContent(metadata.result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  const response = await invokeUpstream({ provider: 'komiku', methodName: 'getChapters', method: entry?.getChapters, args: [url] });
  return { provider: 'komiku', sourceUrl: url, items: normalizeItems(Array.isArray(response.result) ? response.result : []) };
};

export { getKomikuChapters, scrapeKomiku, searchKomiku };
