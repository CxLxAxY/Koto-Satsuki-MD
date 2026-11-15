import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { parseHttpUrl } from '../../../services/scraper-utils/urlValidator.js';

const providerHosts = {
  otakudesu: ['otakudesu.blog', 'otakudesu.best'],
  gogoanime: ['gogoanimes.fi', 'gogoanime.me', 'megaplay.buzz'],
  nimegami: ['nimegami.id'],
  animetosho: ['animetosho.org'],
};

const detectAnimeProvider = (value, names = Object.keys(providerHosts)) => {
  let hostname;
  try {
    hostname = parseHttpUrl(value).hostname;
  } catch (error) {
    throw new ScraperError(error?.code || 'INVALID_URL');
  }
  const provider = names.find((name) =>
    providerHosts[name].some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
  if (!provider) throw new ScraperError('UNSUPPORTED_URL');
  return provider;
};

export { detectAnimeProvider };
