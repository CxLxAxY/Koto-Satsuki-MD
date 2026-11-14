import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { ScraperError } from '../../services/scraper-utils/scraperError.js';
import { executeInfo } from '../scrapers/presentation.js';

const createAnimeProviderCommand = (name, provider, scraper) =>
  createScraperCommand({
    name,
    category: 'Anime',
    description: `Tampilkan metadata anime dari ${provider}.`,
    usage: `${name} <url>`,
    execute: async (context) => {
      if (!context.args[0]) throw new ScraperError('INVALID_INPUT');
      const data = await scraper(context.args[0]);
      return executeInfo({
        title: 'ANIME INFO',
        provider,
        sourceUrl: data.sourceUrl,
        data,
        context,
      });
    },
  });

export { createAnimeProviderCommand };
