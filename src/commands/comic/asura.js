import { createComicProviderCommand } from './command.js';
import { scrapeAsuraScans } from '../../scrapers/comic/asurascans/index.js';

export default createComicProviderCommand('asura', 'asurascans', scrapeAsuraScans);
