import { createDownloaderCommand } from './command.js';
import { scrapeRedNote } from '../../scrapers/downloader/rednote/index.js';

export default createDownloaderCommand('rednote', 'RedNote', scrapeRedNote);
