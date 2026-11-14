import { createResolverCommand } from './command.js';
import { scrapeCatbox } from '../../scrapers/resolver/catbox/index.js';

export default createResolverCommand('catbox', scrapeCatbox);
