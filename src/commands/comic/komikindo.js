import { createComicProviderCommand } from './command.js';
import { scrapeKomikIndo } from '../../scrapers/comic/komikindo/index.js';

export default createComicProviderCommand('komikindo', 'komikindo', scrapeKomikIndo);
