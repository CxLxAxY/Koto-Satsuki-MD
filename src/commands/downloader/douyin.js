import { createDownloaderCommand } from './command.js';
import { scrapeDouyin } from '../../scrapers/downloader/douyin/index.js';

export default createDownloaderCommand('douyin', 'Douyin', scrapeDouyin);
