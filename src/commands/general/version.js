import config from '../../config/config.js';
import { getPackageMetadata } from '../../config/appInfo.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'version',
  aliases: [],
  description: 'Menampilkan versi aplikasi, Node.js, dan Baileys.',
  category: 'General',
  usage: 'version',
  execute: async ({ message, socket }) => {
    const { application, baileys } = await getPackageMetadata();
    return sendReply(
      { message, socket },
      [
        `Aplikasi: ${application.name}`,
        `Versi aplikasi: ${application.version}`,
        `Node.js: ${process.version}`,
        `Baileys: ${baileys.version}`,
      ].join('\n'),
    );
  },
};
