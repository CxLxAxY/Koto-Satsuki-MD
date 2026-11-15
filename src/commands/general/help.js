import config from '../../config/config.js';
import { getCommand } from '../../handlers/commandHandler.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'help',
  aliases: [],
  description: 'Menampilkan panduan penggunaan command.',
  category: 'General',
  usage: 'help [command]',
  execute: async ({ args, message, prefix, socket }) => {
    if (args.length === 0) {
      return sendReply(
        { message, socket },
        `Gunakan ${prefix}menu untuk melihat command.\nGunakan ${prefix}help <command> untuk panduan command tertentu.`,
      );
    }

    const command = getCommand(args[0]);
    if (!command) {
      return sendReply(
        { message, socket },
        `Command "${args[0]}" tidak ditemukan. Gunakan ${prefix}menu untuk melihat daftar command.`,
      );
    }

    const details = [
      `Command: ${prefix}${command.name}`,
      `Category: ${command.category}`,
      `Description: ${command.description}`,
      `Usage: ${prefix}${command.usage}`,
    ];
    if (command.example) {
      details.push(`Example: ${prefix}${command.example}`);
    }
    return sendReply({ message, socket }, details.join('\n'));
  },
};
