import { createComicProviderCommand } from './command.js';
import { scrapeKomiku } from '../../scrapers/comic/komiku/index.js';

export default createComicProviderCommand('komiku', 'komiku', scrapeKomiku);
