import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeTiktokio = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'tiktok',
    methodName: 'tiktokio',
    method: library.tiktok?.tiktokio,
    args: [url],
  });

export { scrapeTiktokio };
