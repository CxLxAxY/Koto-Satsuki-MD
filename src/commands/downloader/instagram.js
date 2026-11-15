import { createDownloaderCommand } from './command.js';
import { scrapeInstagram } from '../../scrapers/downloader/instagram/index.js';

export default createDownloaderCommand('instagram', 'Instagram', scrapeInstagram);
