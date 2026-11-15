import logger from '../../../utils/logger.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { searchOtakudesu } from '../otakudesu/index.js';
import { searchGogoAnime } from '../gogoanime/index.js';

const searchAnime = async (value) => {
  const query = String(value || '').trim();
  if (!query || query.length > 100) throw new ScraperError('INVALID_INPUT');
  const results = await Promise.all([
    searchOtakudesu(query).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
    searchGogoAnime(query).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
  ]);
  if (results.every(({ failed }) => failed)) throw new ScraperError('UPSTREAM_FAILED');
  const seen = new Set();
  const items = results.flatMap(({ items: found }) => found).filter((item) => {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!items.length) throw new ScraperError('NO_RESULTS');
  logger.media('[SCRAPER:ANIME-AGGREGATOR] Success operation=search');
  return { query, items };
};

export { searchAnime };
