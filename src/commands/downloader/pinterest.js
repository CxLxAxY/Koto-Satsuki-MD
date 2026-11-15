import { createDownloaderCommand } from './command.js';
import { scrapePinterest } from '../../scrapers/downloader/pinterest/index.js';

export default createDownloaderCommand('pinterest', 'Pinterest', scrapePinterest);
