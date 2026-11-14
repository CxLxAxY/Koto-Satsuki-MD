import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapePindown = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'pinterest',
    methodName: 'pindown',
    method: library.pinterest?.pindown,
    args: [url],
  });

export { scrapePindown };
