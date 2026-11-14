import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['animetosho.org'];

const scrapeAnimeTosho = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = library.anime?.animetosho;
  const response = await invokeUpstream({
    provider: 'animetosho',
    methodName: 'scrape',
    method: entry?.scrape || entry,
    args: [url],
  });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return {
    provider: 'animetosho',
    sourceUrl: url,
    title: result.title || result.name,
    author: result.author,
    thumbnail: result.thumbnail,
    type: result.type,
    itemCount: Array.isArray(result.downloads) ? result.downloads.length : undefined,
  };
};

export { scrapeAnimeTosho };
