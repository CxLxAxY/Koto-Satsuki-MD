import config from '../../config/config.js';
import {
  CommandValidationError,
  getCommandsByCategory,
} from '../../handlers/commandHandler.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';
import { formatCategoryCommands } from '../../utils/menuFormatter.js';

export default {
  name: 'menucat',
  aliases: [],
  description: 'Menampilkan daftar command berdasarkan kategori.',
  category: 'Menu',
  usage: 'menucat <kategori>',
  example: 'menucat general',
  execute: async ({ args, message, prefix, socket }) => {
    const categoryInput = args.join(' ').trim();
    if (!categoryInput) {
      await sendReply(
        { message, socket },
        `Silakan masukkan nama kategori.\n\nContoh:\n${prefix}menucat general`,
      );
      throw new CommandValidationError('Category argument is required.');
    }

    const registeredCommands = getCommandsByCategory(categoryInput, {
      includeDisabled: true,
    });
    if (registeredCommands.length === 0) {
      await sendReply(
        { message, socket },
        `Kategori tidak ditemukan.\n\nGunakan ${prefix}menu untuk melihat kategori yang tersedia.`,
      );
      throw new CommandValidationError(`Unknown category: ${categoryInput}`);
    }

    const activeCommands = registeredCommands.filter(
      (command) => command.enabled !== false,
    );
    if (activeCommands.length === 0) {
      return sendReply(
        { message, socket },
        `Kategori ${registeredCommands[0].category} belum memiliki command aktif.`,
      );
    }

    return sendReply(
      { message, socket },
      formatCategoryCommands({
        category: activeCommands[0].category,
        commands: activeCommands,
        prefix,
      }),
    );
  },
};
