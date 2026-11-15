import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeBandcampDirect = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'bandcamp',
    methodName: 'direct',
    method: library.bandcamp?.direct,
    args: [url],
  });

export { scrapeBandcampDirect };
