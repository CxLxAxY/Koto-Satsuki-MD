import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeBandcampDownloader = (url, quality = '320', library = scrapr) =>
  invokeUpstream({
    provider: 'bandcamp',
    methodName: 'bandcampdownloader',
    method: library.bandcamp?.bandcampdownloader,
    args: [url, { quality }],
  });

export { scrapeBandcampDownloader };
