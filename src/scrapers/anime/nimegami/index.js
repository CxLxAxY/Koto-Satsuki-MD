import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['nimegami.id'];

const scrapeNimegami = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = library.anime?.nimegami;
  const response = await invokeUpstream({
    provider: 'nimegami',
    methodName: 'scrape',
    method: entry?.scrape || entry,
    args: [url],
  });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return {
    provider: 'nimegami',
    sourceUrl: url,
    title: result.title || result.name,
    author: result.author,
    thumbnail: result.thumbnail,
    type: result.type,
    itemCount: Array.isArray(result.downloads) ? result.downloads.length : undefined,
  };
};

export { scrapeNimegami };
