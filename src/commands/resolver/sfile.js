import { createResolverCommand } from './command.js';
import { scrapeSFile } from '../../scrapers/resolver/sfile/index.js';

export default createResolverCommand('sfile', scrapeSFile);
