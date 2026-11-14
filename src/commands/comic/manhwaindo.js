import { createComicProviderCommand } from './command.js';
import { scrapeManhwaIndo } from '../../scrapers/comic/manhwaindo/index.js';

export default createComicProviderCommand('manhwaindo', 'manhwaindo', scrapeManhwaIndo);
