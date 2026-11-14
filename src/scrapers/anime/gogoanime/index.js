import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['gogoanimes.fi', 'gogoanime.me', 'megaplay.buzz'];
const entryFor = (library) => library.anime?.gogoanime;
const getItems = (response) => Array.isArray(response.result) ? response.result : [];

const normalizeItems = (items) =>
  items.flatMap((item) => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || !isAgeAppropriateContent(item)) return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return [];
      return [{ title: item.title.trim().slice(0, 180), url: url.href, provider: 'gogoanime' }];
    } catch {
      return [];
    }
  }).filter((item) => item.title);

const scrapeGogoAnime = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = entryFor(library);
  const response = await invokeUpstream({
    provider: 'gogoanime', methodName: 'scrape', method: entry?.scrape || entry, args: [url],
  });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return {
    provider: 'gogoanime',
    sourceUrl: url,
    title: result.title || result.name,
    author: result.author,
    thumbnail: result.thumbnail,
    type: result.type,
    itemCount: Array.isArray(result.downloads) ? result.downloads.length : undefined,
  };
};

const searchGogoAnime = async (query, { library = scrapr } = {}) => {
  const response = await invokeUpstream({
    provider: 'gogoanime', methodName: 'search', method: entryFor(library)?.search, args: [query],
  });
  return normalizeItems(getItems(response));
};

const getGogoAnimeEpisodes = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const response = await invokeUpstream({
    provider: 'gogoanime',
    methodName: 'getEpisodes',
    method: entryFor(library)?.getEpisodes,
    args: [url],
  });
  return { provider: 'gogoanime', sourceUrl: url, items: normalizeItems(getItems(response)) };
};

export { getGogoAnimeEpisodes, scrapeGogoAnime, searchGogoAnime };
