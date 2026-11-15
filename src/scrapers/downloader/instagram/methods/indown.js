import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeIndown = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'instagram',
    methodName: 'indown',
    method: library.instagram?.indown,
    args: [url],
  });

export { scrapeIndown };
