import { createDownloaderCommand } from './command.js';
import { scrapeFacebook } from '../../scrapers/downloader/facebook/index.js';

export default createDownloaderCommand('facebook', 'Facebook', scrapeFacebook);
