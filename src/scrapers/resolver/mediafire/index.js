import scrapr from '@coflyn/scrapr';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { invokeUpstream } from '../../../services/scraper-utils/invokeUpstream.js';
import { validatePublicUrl } from '../../../services/scraper-utils/urlValidator.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';

const hosts = ['mediafire.com'];

const scrapeMediaFire = async (value, { lookup, library = scrapr } = {}) => {
  const originalUrl = await validateAllowedUrl(value, { hosts, lookup });
  const response = await invokeUpstream({
    provider: 'mediafire',
    methodName: 'mediafire',
    method: library.resolver?.mediafire,
    args: [originalUrl],
  });
  const result = response.result;
  const resolvedUrl = result?.url || result?.destinationUrl || result?.destination;
  if (typeof resolvedUrl !== 'string' || !resolvedUrl.trim()) {
    throw new ScraperError('UPSTREAM_FAILED');
  }
  await validatePublicUrl(resolvedUrl, { lookup });
  return {
    provider: 'mediafire',
    originalUrl,
    resolvedUrl,
    fileName: result.fileName || result.filename || result.name || result.title,
    fileSize: result.fileSize ?? result.filesize ?? result.size,
    result,
  };
};

export { scrapeMediaFire };
