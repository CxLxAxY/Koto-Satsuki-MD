import { createDownloaderCommand } from './command.js';
import { scrapeYoutubeVideo } from '../../scrapers/downloader/youtube/index.js';

export default createDownloaderCommand('ytmp4', 'YouTube', scrapeYoutubeVideo, { format: 'mp4' });
