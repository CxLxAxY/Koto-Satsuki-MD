import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeYtmp3gg = (url, options = {}, library = scrapr) =>
  invokeUpstream({
    provider: 'youtube',
    methodName: 'ytmp3gg',
    method: library.youtube?.ytmp3gg,
    args: [url, options],
    timeoutMs: 45000,
  });

export { scrapeYtmp3gg };
