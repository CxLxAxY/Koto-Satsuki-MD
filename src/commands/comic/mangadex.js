import { createComicProviderCommand } from './command.js';
import { scrapeMangaDex } from '../../scrapers/comic/mangadex/index.js';

export default createComicProviderCommand('mangadex', 'mangadex', scrapeMangaDex);
