import { createResolverCommand } from './command.js';
import { scrapePixelDrain } from '../../scrapers/resolver/pixeldrain/index.js';

export default createResolverCommand('pixeldrain', scrapePixelDrain);
