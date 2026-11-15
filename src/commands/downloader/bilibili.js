import { createDownloaderCommand } from './command.js';
import { scrapeBilibili } from '../../scrapers/downloader/bilibili/index.js';

export default createDownloaderCommand('bilibili', 'Bilibili', scrapeBilibili);
