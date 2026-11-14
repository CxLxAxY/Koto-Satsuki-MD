import { registerCommand } from '../../handlers/commandHandler.js';
import applemusic from './applemusic.js';
import bandcamp from './bandcamp.js';
import bilibili from './bilibili.js';
import douyin from './douyin.js';
import facebook from './facebook.js';
import instagram from './instagram.js';
import pinterest from './pinterest.js';
import pixiv from './pixiv.js';
import reddit from './reddit.js';
import rednote from './rednote.js';
import soundcloud from './soundcloud.js';
import spotify from './spotify.js';
import terabox from './terabox.js';
import threads from './threads.js';
import tiktok from './tiktok.js';
import twitter from './twitter.js';
import ytmp3 from './ytmp3.js';
import ytmp4 from './ytmp4.js';
import ytplaylist from './ytplaylist.js';

const commands = [
  tiktok,
  instagram,
  ytmp3,
  ytmp4,
  ytplaylist,
  facebook,
  twitter,
  spotify,
  soundcloud,
  pinterest,
  reddit,
  threads,
  terabox,
  bilibili,
  douyin,
  bandcamp,
  applemusic,
  pixiv,
  rednote,
];
let registered = false;

const registerDownloaderCommands = () => {
  if (registered) return;
  for (const command of commands) registerCommand(command);
  registered = true;
};

export { registerDownloaderCommands };
