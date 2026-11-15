import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapePinterestDirect = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'pinterest',
    methodName: 'direct',
    method: library.pinterest?.direct,
    args: [url],
  });

export { scrapePinterestDirect };
