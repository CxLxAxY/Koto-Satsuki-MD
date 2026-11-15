import { createDownloaderCommand } from './command.js';
import { scrapeTeraBox } from '../../scrapers/downloader/terabox/index.js';

export default createDownloaderCommand('terabox', 'TeraBox', scrapeTeraBox);
