import { createDownloaderCommand } from './command.js';
import { scrapeSpotify } from '../../scrapers/downloader/spotify/index.js';

export default createDownloaderCommand('spotify', 'Spotify', scrapeSpotify);
