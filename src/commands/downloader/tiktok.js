import { createDownloaderCommand } from './command.js';
import { scrapeTikTok } from '../../scrapers/downloader/tiktok/index.js';

export default createDownloaderCommand('tiktok', 'TikTok', scrapeTikTok);
