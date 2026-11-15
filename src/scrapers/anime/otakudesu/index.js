import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['otakudesu.blog', 'otakudesu.best'];
const entryFor = (library) => library.anime?.otakudesu;

const getItems = (response) =>
  Array.isArray(response.result) ? response.result : [];

const normalizeItems = (items) =>
  items.flatMap((item) => {
    if (!item || typeof item.title !== 'string' || typeof item.url !== 'string' || !isAgeAppropriateContent(item)) return [];
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || !hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) return [];
      return [{ title: item.title.trim().slice(0, 180), url: url.href, provider: 'otakudesu' }];
    } catch {
      return [];
    }
  }).filter((item) => item.title);

const scrapeOtakudesu = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = entryFor(library);
  const response = await invokeUpstream({
    provider: 'otakudesu', methodName: 'scrape', method: entry?.scrape || entry, args: [url],
  });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return {
    provider: 'otakudesu',
    sourceUrl: url,
    title: result.title || result.name,
    author: result.author,
    thumbnail: result.thumbnail,
    type: result.type,
    itemCount: Array.isArray(result.downloads) ? result.downloads.length : undefined,
  };
};

const searchOtakudesu = async (query, { library = scrapr } = {}) => {
  const response = await invokeUpstream({
    provider: 'otakudesu', methodName: 'search', method: entryFor(library)?.search, args: [query],
  });
  return normalizeItems(getItems(response));
};

const getOtakudesuEpisodes = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const response = await invokeUpstream({
    provider: 'otakudesu',
    methodName: 'getEpisodes',
    method: entryFor(library)?.getEpisodes,
    args: [url],
  });
  return { provider: 'otakudesu', sourceUrl: url, items: normalizeItems(getItems(response)) };
};

export { getOtakudesuEpisodes, scrapeOtakudesu, searchOtakudesu };
