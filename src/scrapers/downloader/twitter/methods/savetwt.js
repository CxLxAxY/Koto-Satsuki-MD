import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSavetwt = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'twitter',
    methodName: 'savetwt',
    method: library.twitter?.savetwt,
    args: [url],
  });

export { scrapeSavetwt };
