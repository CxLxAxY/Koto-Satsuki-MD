import { createComicProviderCommand } from './command.js';
import { scrapeKiryuu } from '../../scrapers/comic/kiryuu/index.js';

export default createComicProviderCommand('kiryuu', 'kiryuu', scrapeKiryuu);
