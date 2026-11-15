import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeFdown = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'facebook',
    methodName: 'fdown',
    method: library.facebook?.fdown,
    args: [url],
  });

export { scrapeFdown };
