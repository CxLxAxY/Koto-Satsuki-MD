import { createComicProviderCommand } from './command.js';
import { scrapeMangaBats } from '../../scrapers/comic/mangabats/index.js';

export default createComicProviderCommand('mangabats', 'mangabats', scrapeMangaBats, ['mangabat']);
