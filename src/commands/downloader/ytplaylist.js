import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { scrapeYoutubePlaylist } from '../../scrapers/downloader/youtube/index.js';
import { executeYoutubePlaylist } from '../scrapers/presentation.js';

export default createScraperCommand({
  name: 'ytplaylist',
  category: 'Downloader',
  description: 'Tampilkan metadata dan item playlist YouTube.',
  usage: 'ytplaylist <url> [--page=N]',
  execute: (context) =>
    executeYoutubePlaylist({ scraper: scrapeYoutubePlaylist, ...context }),
});
