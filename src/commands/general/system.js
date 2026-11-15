import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { formatBytes, sendReply } from '../../utils/formatter.js';

export default {
  name: 'system',
  aliases: [],
  description: 'Menampilkan penggunaan resource proses bot.',
  category: 'General',
  usage: 'system',
  execute: async ({ message, socket }) => {
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage();
    const uptimeSeconds = process.uptime();
    const cpuPercent =
      uptimeSeconds > 0
        ? ((cpu.user + cpu.system) / 1_000_000 / uptimeSeconds) * 100
        : 0;

    return sendReply(
      { message, socket },
      [
        `RSS memory: ${formatBytes(memory.rss)}`,
        `Heap used: ${formatBytes(memory.heapUsed)}`,
        `Heap total: ${formatBytes(memory.heapTotal)}`,
        `External memory: ${formatBytes(memory.external)}`,
        `CPU rata-rata proses: ${cpuPercent.toFixed(2)}% sejak proses dimulai`,
      ].join('\n'),
    );
  },
};
