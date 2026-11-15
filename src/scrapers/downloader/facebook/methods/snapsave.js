import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeFacebookSnapsave = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'facebook',
    methodName: 'snapsave',
    method: library.facebook?.snapsave,
    args: [url],
  });

export { scrapeFacebookSnapsave };
