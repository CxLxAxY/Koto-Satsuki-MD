import { createDownloaderCommand } from './command.js';
import { scrapeYoutubeAudio } from '../../scrapers/downloader/youtube/index.js';

export default createDownloaderCommand('ytmp3', 'YouTube', scrapeYoutubeAudio, { format: 'mp3' });
