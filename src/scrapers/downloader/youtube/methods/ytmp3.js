import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeYtmp3 = (url, format = 'mp3', library = scrapr) =>
  invokeUpstream({
    provider: 'youtube',
    methodName: 'ytmp3',
    method: library.youtube?.ytmp3,
    args: [url, format],
    timeoutMs: 45000,
  });

export { scrapeYtmp3 };
