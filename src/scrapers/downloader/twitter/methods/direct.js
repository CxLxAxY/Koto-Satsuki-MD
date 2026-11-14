import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeTwitterDirect = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'twitter',
    methodName: 'direct',
    method: library.twitter?.direct,
    args: [url],
  });

export { scrapeTwitterDirect };
