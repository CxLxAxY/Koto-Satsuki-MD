import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { executeResolver } from '../scrapers/presentation.js';

const createResolverCommand = (provider, scraper, name = provider) =>
  createScraperCommand({
    name,
    category: 'Resolver',
    description: `Resolve URL publik ${provider} menjadi tautan tujuan.`,
    usage: `${name} <url>`,
    execute: (context) => executeResolver({ provider, scraper, ...context }),
  });

export { createResolverCommand };
