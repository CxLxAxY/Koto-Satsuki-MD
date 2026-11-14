import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import { comicChapterCommand, searchComicCommand } from './execute.js';

const createComicSearchCommand = () =>
  createScraperCommand({
    name: 'comicsearch',
    category: 'Comic',
    description: 'Cari comic dan manga pada provider yang mendukung pencarian.',
    usage: 'comicsearch <query> [--page=N]',
    execute: searchComicCommand,
  });

const createComicChapterCommand = () =>
  createScraperCommand({
    name: 'comicchapter',
    category: 'Comic',
    description: 'Tampilkan daftar chapter dari provider yang mendukungnya.',
    usage: 'comicchapter <url> [--page=N]',
    execute: comicChapterCommand,
  });

export { createComicChapterCommand, createComicSearchCommand };
