import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSoundloaders = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'spotify',
    methodName: 'soundloaders',
    method: library.spotify?.soundloaders,
    args: [url],
  });

export { scrapeSoundloaders };
