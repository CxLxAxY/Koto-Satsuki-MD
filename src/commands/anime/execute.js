import { resolveAnimeEpisodes } from '../../scrapers/anime/aggregators/episodes.js';
import { resolveAnimePage } from '../../scrapers/anime/aggregators/info.js';
import { searchAnime } from '../../scrapers/anime/aggregators/search.js';
import { ScraperError } from '../../services/scraper-utils/scraperError.js';
import { executeInfo, executeList, executeSearch, getPage } from '../scrapers/presentation.js';

const searchAnimeCommand = async (context) => {
  const { args, page } = getPage(context.args);
  const query = args.join(' ').trim();
  const result = await searchAnime(query);
  return executeSearch({
    title: 'ANIME',
    query: result.query,
    items: result.items,
    page,
    context,
  });
};

const animeInfoCommand = async (context) => {
  const url = context.args[0];
  if (!url) {
    throw new ScraperError('INVALID_INPUT');
  }
  const data = await resolveAnimePage({ url });
  return executeInfo({
    title: 'ANIME INFO',
    provider: data.provider,
    sourceUrl: data.sourceUrl,
    data,
    context,
  });
};

const animeEpisodeCommand = async (context) => {
  const { args, page } = getPage(context.args);
  if (!args[0]) {
    throw new ScraperError('INVALID_INPUT');
  }
  const result = await resolveAnimeEpisodes({ url: args[0] });
  return executeList({
    title: 'ANIME EPISODES',
    provider: result.provider,
    sourceUrl: result.sourceUrl,
    items: result.items,
    page,
    context,
    itemLabel: 'Jumlah episode',
  });
};

export {
  animeEpisodeCommand,
  animeInfoCommand,
  searchAnimeCommand,
};
