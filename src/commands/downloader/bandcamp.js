import { createDownloaderCommand } from './command.js';
import { scrapeBandcamp } from '../../scrapers/downloader/bandcamp/index.js';

export default createDownloaderCommand('bandcamp', 'Bandcamp', scrapeBandcamp);
