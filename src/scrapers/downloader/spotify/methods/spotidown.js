import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSpotidown = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'spotify',
    methodName: 'spotidown',
    method: library.spotify?.spotidown,
    args: [url],
  });

export { scrapeSpotidown };
