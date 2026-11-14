import { createResolverCommand } from './command.js';
import { resolvePublicUrl } from '../../scrapers/resolver/unshorten/index.js';

const scrapeUnshorten = async (url) => {
  const resolved = await resolvePublicUrl(url);
  return { provider: 'unshorten', ...resolved.result };
};

export default createResolverCommand('unshorten', scrapeUnshorten);
