import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { ScraperError } from '../../services/scraper-utils/scraperError.js';
import { executeInfo } from '../scrapers/presentation.js';

const createComicProviderCommand = (name, provider, scraper, aliases = []) =>
  createScraperCommand({
    name,
    aliases,
    category: 'Comic',
    description: `Tampilkan metadata comic dari ${provider}.`,
    usage: `${name} <url>`,
    execute: async (context) => {
      if (!context.args[0]) throw new ScraperError('INVALID_INPUT');
      const data = await scraper(context.args[0]);
      return executeInfo({
        title: 'COMIC INFO',
        provider,
        sourceUrl: data.sourceUrl,
        data,
        context,
      });
    },
  });

export { createComicProviderCommand };
