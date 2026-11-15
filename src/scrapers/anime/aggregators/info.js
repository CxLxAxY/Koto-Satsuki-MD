import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { scrapeOtakudesu } from '../otakudesu/index.js';
import { scrapeGogoAnime } from '../gogoanime/index.js';
import { scrapeNimegami } from '../nimegami/index.js';
import { scrapeAnimeTosho } from '../animetosho/index.js';
import { detectAnimeProvider } from './providerResolver.js';

const providerScrapers = {
  otakudesu: scrapeOtakudesu,
  gogoanime: scrapeGogoAnime,
  nimegami: scrapeNimegami,
  animetosho: scrapeAnimeTosho,
};

const resolveAnimePage = async ({ provider, url }) => {
  const resolvedProvider = provider || detectAnimeProvider(url);
  const scraper = providerScrapers[resolvedProvider];
  if (!scraper) throw new ScraperError('SCRAPER_UNAVAILABLE');
  return scraper(url);
};

export { resolveAnimePage };
