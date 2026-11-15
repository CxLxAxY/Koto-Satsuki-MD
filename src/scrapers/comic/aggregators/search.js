import logger from '../../../utils/logger.js';
import { ScraperError } from '../../../services/scraper-utils/scraperError.js';
import { searchKomikIndo } from '../komikindo/index.js';
import { searchKomiku } from '../komiku/index.js';
import { searchAsuraScans } from '../asurascans/index.js';

const searchComic = async (value) => {
  const query = String(value || '').trim();
  if (!query || query.length > 100) throw new ScraperError('INVALID_INPUT');
  const responses = await Promise.all([
    searchKomikIndo(query).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
    searchKomiku(query).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
    searchAsuraScans(query).then((items) => ({ items, failed: false })).catch(() => ({ items: [], failed: true })),
  ]);
  if (responses.every(({ failed }) => failed)) throw new ScraperError('UPSTREAM_FAILED');
  const seen = new Set();
  const items = responses.flatMap(({ items: found }) => found).filter((item) => {
    const key = item.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!items.length) throw new ScraperError('NO_RESULTS');
  logger.media('[SCRAPER:COMIC-AGGREGATOR] Success operation=search');
  return { query, items };
};

export { searchComic };
