import logger from '../../../utils/logger.js';
import { validateAllowedUrl } from '../../../services/scraper-utils/allowedUrl.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeBandcampDirect } from './methods/direct.js';
import { scrapeBandcampDownloader } from './methods/bandcampdownloader.js';

const hosts = ['bandcamp.com'];
const fallbackMethods = [
  ['direct', scrapeBandcampDirect],
  ['bandcampdownloader', (url) => scrapeBandcampDownloader(url, '320')],
];

const isAudioItem = (item) =>
  item &&
  typeof item.url === 'string' &&
  /audio|mp3|flac|download\s+(?:audio|mp3|flac)/iu.test(
    `${item.type || ''} ${item.quality || ''}`,
  );

const getBandcampTracks = (result) => {
  if (!Array.isArray(result?.tracks)) return [];
  return result.tracks.map((track, index) => ({
    title: track.title,
    artist: track.artist,
    downloads: Array.isArray(track.downloads) ? track.downloads.filter(isAudioItem) : [],
    index: track.index || index + 1,
  }));
};

const scrapeBandcamp = async (value, { lookup, methods: overrides = {} } = {}) => {
  const url = await validateAllowedUrl(value, { hosts, lookup });
  let lastError;
  let temporaryError;
  for (const [methodName, defaultMethod] of fallbackMethods) {
    try {
      const response = await (overrides[methodName] || defaultMethod)(url);
      const result = response.result;
      const tracks = getBandcampTracks(result);
      const downloads = tracks.length
        ? tracks.flatMap((track) =>
            track.downloads.map((item) => ({ ...item, title: item.title || track.title })),
          )
        : Array.isArray(result?.downloads)
          ? result.downloads.filter(isAudioItem)
          : [];
      const validDownloads = downloads.filter((item) => {
        try {
          return new URL(item.url).protocol === 'https:';
        } catch {
          return false;
        }
      });
      if (validDownloads.length === 0) throw new ScraperError('UPSTREAM_FAILED');
      return {
        success: true,
        provider: 'bandcamp',
        method: methodName,
        title: result.title,
        thumbnail: result.cover || result.thumbnail,
        type: result.type === 'album' ? 'album' : 'track',
        trackCount: result.trackCount || result.tracks?.length || 1,
        tracks,
        downloads: validDownloads,
        result,
      };
    } catch (error) {
      lastError = error;
      if (['RATE_LIMITED', 'TIMEOUT'].includes(error?.code)) temporaryError = error;
      if (methodName !== fallbackMethods.at(-1)[0]) {
        logger.media(`[SCRAPER:BANDCAMP] Fallback after method=${methodName} code=${error?.code || 'UPSTREAM_FAILED'}`);
      }
    }
  }
  throw temporaryError || (lastError?.code === 'SCRAPER_UNAVAILABLE' ? lastError : new ScraperError('UPSTREAM_FAILED'));
};

export { scrapeBandcamp };
