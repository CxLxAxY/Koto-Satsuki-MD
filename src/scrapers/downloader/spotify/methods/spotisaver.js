import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSpotisaver = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'spotify',
    methodName: 'spotisaver',
    method: library.spotify?.spotisaver,
    args: [url],
  });

export { scrapeSpotisaver };
