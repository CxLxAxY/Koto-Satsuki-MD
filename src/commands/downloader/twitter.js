import { createDownloaderCommand } from './command.js';
import { scrapeTwitter } from '../../scrapers/downloader/twitter/index.js';

export default createDownloaderCommand('twitter', 'Twitter', scrapeTwitter);
