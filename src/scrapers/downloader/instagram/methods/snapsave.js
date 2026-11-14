import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeInstagramSnapsave = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'instagram',
    methodName: 'snapsave',
    method: library.instagram?.snapsave,
    args: [url],
  });

export { scrapeInstagramSnapsave };
