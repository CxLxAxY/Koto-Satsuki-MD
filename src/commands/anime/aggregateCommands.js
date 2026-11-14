import { createScraperCommand } from '../scrapers/createScraperCommand.js';
import {
  animeEpisodeCommand,
  animeInfoCommand,
  searchAnimeCommand,
} from './execute.js';

const createAnimeSearchCommand = () =>
  createScraperCommand({
    name: 'animesearch',
    category: 'Anime',
    description: 'Cari judul anime pada provider yang mendukung pencarian.',
    usage: 'animesearch <query> [--page=N]',
    execute: searchAnimeCommand,
  });

const createAnimeEpisodeCommand = () =>
  createScraperCommand({
    name: 'animeepisode',
    category: 'Anime',
    description: 'Tampilkan daftar episode pada provider yang mendukungnya.',
    usage: 'animeepisode <url> [--page=N]',
    execute: animeEpisodeCommand,
  });

const createAnimeInfoCommand = () =>
  createScraperCommand({
    name: 'animeinfo',
    category: 'Anime',
    description: 'Tampilkan metadata anime berdasarkan URL provider.',
    usage: 'animeinfo <url>',
    execute: animeInfoCommand,
  });

export {
  createAnimeEpisodeCommand,
  createAnimeInfoCommand,
  createAnimeSearchCommand,
};
