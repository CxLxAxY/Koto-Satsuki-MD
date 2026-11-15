import { createAnimeProviderCommand } from './command.js';
import { scrapeGogoAnime } from '../../scrapers/anime/gogoanime/index.js';

export default createAnimeProviderCommand('gogoanime', 'gogoanime', scrapeGogoAnime);
