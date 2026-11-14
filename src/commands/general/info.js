import config from '../../config/config.js';
import { getPackageMetadata } from '../../config/appInfo.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'info',
  aliases: [],
  description: 'Menampilkan informasi aplikasi dan koneksi.',
  category: 'General',
  usage: 'info',
  execute: async ({ authStatus, connectionState, message, prefix, socket }) => {
    const { application } = await getPackageMetadata();
    const runtime = process.env.NODE_ENV || config.identity.mode;
    const content = [
      `Nama: ${config.identity.botName}`,
      `Versi: ${application.version}`,
      `Owner: ${config.identity.ownerName}`,
      `Nomor owner: ${config.identity.ownerNumber}`,
      `Prefix: ${prefix}`,
      `Runtime: Node.js ${process.version} (${runtime})`,
      `Koneksi WhatsApp: ${connectionState === 'CONNECTED' ? 'Online' : connectionState}`,
      `Autentikasi: ${authStatus}`,
    ].join('\n');

    return sendReply({ message, socket }, content);
  },
};
