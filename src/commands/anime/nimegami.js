import { createAnimeProviderCommand } from './command.js';
import { scrapeNimegami } from '../../scrapers/anime/nimegami/index.js';

export default createAnimeProviderCommand('nimegami', 'nimegami', scrapeNimegami);
