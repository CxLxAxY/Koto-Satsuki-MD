import { resolveComicChapters } from '../../scrapers/comic/aggregators/chapters.js';
import { searchComic } from '../../scrapers/comic/aggregators/search.js';
import { ScraperError } from '../../services/scraper-utils/scraperError.js';
import { executeInfo, executeList, executeSearch, getPage } from '../scrapers/presentation.js';

const searchComicCommand = async (context) => {
  const { args, page } = getPage(context.args);
  const query = args.join(' ').trim();
  const result = await searchComic(query);
  return executeSearch({
    title: 'COMIC',
    query: result.query,
    items: result.items,
    page,
    context,
  });
};

const comicChapterCommand = async (context) => {
  const { args, page } = getPage(context.args);
  if (!args[0]) {
    throw new ScraperError('INVALID_INPUT');
  }
  const result = await resolveComicChapters({ url: args[0] });
  return executeList({
    title: 'COMIC CHAPTERS',
    provider: result.provider,
    sourceUrl: result.sourceUrl,
    items: result.items,
    page,
    context,
    itemLabel: 'Jumlah chapter',
  });
};

export { comicChapterCommand, searchComicCommand };
