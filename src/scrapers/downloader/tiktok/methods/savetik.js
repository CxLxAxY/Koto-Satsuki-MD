import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSavetik = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'tiktok',
    methodName: 'savetik',
    method: library.tiktok?.savetik,
    args: [url],
  });

export { scrapeSavetik };
