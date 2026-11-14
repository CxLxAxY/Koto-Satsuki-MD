import { createDownloaderCommand } from './command.js';
import { scrapeAppleMusic } from '../../scrapers/downloader/applemusic/index.js';

export default createDownloaderCommand('applemusic', 'Apple Music', scrapeAppleMusic);
