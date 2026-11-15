import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeSsstik = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'tiktok',
    methodName: 'ssstik',
    method: library.tiktok?.ssstik,
    args: [url],
  });

export { scrapeSsstik };
