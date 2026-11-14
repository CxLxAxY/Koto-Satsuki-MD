import { createAnimeProviderCommand } from './command.js';
import { scrapeOtakudesu } from '../../scrapers/anime/otakudesu/index.js';

export default createAnimeProviderCommand('otakudesu', 'otakudesu', scrapeOtakudesu);
