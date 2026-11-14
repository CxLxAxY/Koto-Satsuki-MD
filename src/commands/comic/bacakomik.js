import { createComicProviderCommand } from './command.js';
import { scrapeBacaKomik } from '../../scrapers/comic/bacakomik/index.js';

export default createComicProviderCommand('bacakomik', 'bacakomik', scrapeBacaKomik);
