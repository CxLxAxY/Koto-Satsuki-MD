import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { parseHttpUrl } from '../../../services/scraper-utils/urlValidator.js';
import { getKomikIndoChapters } from '../komikindo/index.js';
import { getKomikuChapters } from '../komiku/index.js';
import { getAsuraScansChapters } from '../asurascans/index.js';

const providerHosts = {
  komikindo: ['komikindo.ch'],
  komiku: ['komiku.org'],
  asurascans: ['asurascans.com', 'asuracomic.net'],
};
const chapterScrapers = {
  komikindo: getKomikIndoChapters,
  komiku: getKomikuChapters,
  asurascans: getAsuraScansChapters,
};

const resolveComicChapters = async ({ url }) => {
  let hostname;
  try {
    hostname = parseHttpUrl(url).hostname;
  } catch (error) {
    throw new ScraperError(error?.code || 'INVALID_URL');
  }
  const provider = Object.keys(chapterScrapers).find((name) =>
    providerHosts[name].some((host) => hostname === host || hostname.endsWith(`.${host}`)),
  );
  if (!provider) throw new ScraperError('UNSUPPORTED_URL');
  const result = await chapterScrapers[provider](url);
  if (!result.items.length) throw new ScraperError('NO_RESULTS');
  return result;
};

export { resolveComicChapters };
