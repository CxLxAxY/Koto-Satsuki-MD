import { createDownloaderCommand } from './command.js';
import { scrapeThreads } from '../../scrapers/downloader/threads/index.js';

export default createDownloaderCommand('threads', 'Threads', scrapeThreads);
