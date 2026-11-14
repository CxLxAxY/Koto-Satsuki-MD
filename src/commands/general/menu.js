import { basename } from 'node:path';
import config from '../../config/config.js';
import { getCommands } from '../../handlers/commandHandler.js';
import logger from '../../utils/logger.js';
import { executeMenu } from '../../utils/menuFormatter.js';
import { loadMenuImage } from '../../utils/menuImage.js';
import { resolveSenderJid } from '../../utils/senderResolver.js';

export default {
  name: 'menu',
  aliases: [],
  description: 'Menampilkan daftar command yang tersedia.',
  category: 'General',
  usage: 'menu',
  execute: async (context) => {
    const response = await executeMenu(context, {
      botNumber: resolveSenderJid(context.socket?.user?.id),
      commands: getCommands(),
      imageEnabled: config.menu.imageEnabled,
      imageName: basename(config.menu.imagePath),
      imageLoader: loadMenuImage,
      logger,
    });
    return response;
  },
};
