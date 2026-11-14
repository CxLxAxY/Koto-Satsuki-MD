import { createResolverCommand } from './command.js';
import { scrapeMediaFire } from '../../scrapers/resolver/mediafire/index.js';

export default createResolverCommand('mediafire', scrapeMediaFire);
