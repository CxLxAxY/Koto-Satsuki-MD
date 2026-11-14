import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeTweeload = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'twitter',
    methodName: 'tweeload',
    method: library.twitter?.tweeload,
    args: [url],
  });

export { scrapeTweeload };
