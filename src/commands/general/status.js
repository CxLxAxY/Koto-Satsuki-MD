import config from '../../config/config.js';
import { getCommands } from '../../handlers/commandHandler.js';
import logger from '../../utils/logger.js';
import { formatDuration, sendReply } from '../../utils/formatter.js';

export default {
  name: 'status',
  aliases: [],
  description: 'Menampilkan status koneksi, autentikasi, dan command handler.',
  category: 'General',
  usage: 'status',
  execute: async ({ authStatus, connectionState, message, socket }) => {
    const connected = connectionState === 'CONNECTED';
    const commandCount = getCommands().length;
    return sendReply(
      { message, socket },
      [
        `WhatsApp: ${connected ? 'Online' : connectionState}`,
        `Autentikasi: ${authStatus}`,
        `Uptime: ${formatDuration(process.uptime())}`,
        `Command handler: ${commandCount > 0 ? `Ready (${commandCount} commands)` : 'Tidak aktif'}`,
      ].join('\n'),
    );
  },
};
