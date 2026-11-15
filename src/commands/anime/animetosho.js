import { createAnimeProviderCommand } from './command.js';
import { scrapeAnimeTosho } from '../../scrapers/anime/animetosho/index.js';

export default createAnimeProviderCommand('animetosho', 'animetosho', scrapeAnimeTosho);
