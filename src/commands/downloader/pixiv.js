import { createDownloaderCommand } from './command.js';
import { scrapePixiv } from '../../scrapers/downloader/pixiv/index.js';

export default createDownloaderCommand('pixiv', 'Pixiv', scrapePixiv);
