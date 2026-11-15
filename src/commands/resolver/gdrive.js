import { createResolverCommand } from './command.js';
import { scrapeGoogleDrive } from '../../scrapers/resolver/gdrive/index.js';

export default createResolverCommand('gdrive', scrapeGoogleDrive);
