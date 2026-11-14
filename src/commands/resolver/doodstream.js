import { createResolverCommand } from './command.js';
import { scrapeDoodStream } from '../../scrapers/resolver/doodstream/index.js';

export default createResolverCommand('doodstream', scrapeDoodStream);
