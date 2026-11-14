import { createDownloaderCommand } from './command.js';
import { scrapeSoundCloud } from '../../scrapers/downloader/soundcloud/index.js';

export default createDownloaderCommand('soundcloud', 'SoundCloud', scrapeSoundCloud);
