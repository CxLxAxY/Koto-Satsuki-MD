import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { executeDownload } from '../scrapers/presentation.js';

const createDownloaderCommand = (name, platform, scrape, { format, usage } = {}) =>
  createScraperCommand({
    name,
    category: 'Downloader',
    description: `Ambil media dari URL ${platform}. Gunakan hanya untuk konten yang boleh Anda bagikan.`,
    usage: usage || `${name} <url>`,
    execute: (context) =>
      executeDownload({ platform, scrape, args: context.args, context, format }),
  });

export { createDownloaderCommand };
