import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { getOtakudesuEpisodes } from '../otakudesu/index.js';
import { getGogoAnimeEpisodes } from '../gogoanime/index.js';
import { detectAnimeProvider } from './providerResolver.js';

const episodeScrapers = {
  otakudesu: getOtakudesuEpisodes,
  gogoanime: getGogoAnimeEpisodes,
};

const resolveAnimeEpisodes = async ({ url }) => {
  const provider = detectAnimeProvider(url, Object.keys(episodeScrapers));
  const result = await episodeScrapers[provider](url);
  if (!result.items.length) throw new ScraperError('NO_RESULTS');
  return result;
};

export { resolveAnimeEpisodes };
