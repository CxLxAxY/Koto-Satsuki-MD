import scrapr from '@coflyn/scrapr';
import { invokeUpstream } from '../../../../services/scraper-utils/invokeUpstream.js';

const scrapeYoutubePlaylist = (url, library = scrapr) =>
  invokeUpstream({
    provider: 'youtube',
    methodName: 'playlist',
    method: library.youtube?.playlist,
    args: [url],
    timeoutMs: 45000,
  });

export { scrapeYoutubePlaylist };
