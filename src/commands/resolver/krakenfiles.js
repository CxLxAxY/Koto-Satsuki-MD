import { createResolverCommand } from './command.js';
import { scrapeKrakenFiles } from '../../scrapers/resolver/krakenfiles/index.js';

export default createResolverCommand('krakenfiles', scrapeKrakenFiles);
