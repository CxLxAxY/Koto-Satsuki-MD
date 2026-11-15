import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeInstagramDirect = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'instagram',
    methodName: 'direct',
    method: library.instagram?.direct,
    args: [url],
  });

export { scrapeInstagramDirect };
