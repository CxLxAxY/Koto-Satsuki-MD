import { createComicProviderCommand } from './command.js';
import { scrapeKomikcast } from '../../scrapers/comic/komikcast/index.js';

export default createComicProviderCommand('komikcast', 'komikcast', scrapeKomikcast);
