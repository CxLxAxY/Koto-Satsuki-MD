import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSnapinsta = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'instagram',
    methodName: 'snapinsta',
    method: library.instagram?.snapinsta,
    args: [url],
  });

export { scrapeSnapinsta };
