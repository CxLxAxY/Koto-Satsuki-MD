import { createDownloaderCommand } from './command.js';
import { scrapeReddit } from '../../scrapers/downloader/reddit/index.js';

export default createDownloaderCommand('reddit', 'Reddit', scrapeReddit);
