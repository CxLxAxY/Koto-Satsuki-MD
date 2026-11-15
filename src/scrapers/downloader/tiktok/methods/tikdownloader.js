import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeTikdownloader = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'tiktok',
    methodName: 'tikdownloader',
    method: library.tiktok?.tikdownloader,
    args: [url],
  });

export { scrapeTikdownloader };
