import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { isAgeAppropriateContent } from '../../../services/scraper-utils/contentPolicy.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['komikcast.bz'];

const scrapeKomikcast = async (value, { lookup, library = scrapr } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  const entry = library.comic?.komikcast;
  const response = await invokeUpstream({ provider: 'komikcast', methodName: 'scrape', method: entry?.scrape || entry, args: [url] });
  const result = response.result || {};
  if (!isAgeAppropriateContent(result)) throw new ScraperError('UNSUPPORTED_CONTENT');
  return { provider: 'komikcast', sourceUrl: url, title: result.title || result.name, author: result.author, thumbnail: result.thumbnail, type: result.type };
};

export { scrapeKomikcast };
