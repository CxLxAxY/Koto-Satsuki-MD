import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeTvd = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'twitter',
    methodName: 'tvd',
    method: library.twitter?.tvd,
    args: [url],
  });

export { scrapeTvd };
