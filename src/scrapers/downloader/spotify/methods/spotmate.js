import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSpotmate = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'spotify',
    methodName: 'spotmate',
    method: library.spotify?.spotmate,
    args: [url],
  });

export { scrapeSpotmate };
