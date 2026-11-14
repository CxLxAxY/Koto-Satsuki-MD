import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSnaptik = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'tiktok',
    methodName: 'snaptik',
    method: library.tiktok?.snaptik,
    args: [url],
  });

export { scrapeSnaptik };
