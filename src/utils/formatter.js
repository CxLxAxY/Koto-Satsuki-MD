import config from '../config/config.js';
import { sendCommandResponse } from '../core/messageSender.js';
import { buildNewsletterContext } from './newsletterContext.js';

const formatBotMessage = (content) => `*${config.identity.botName}*\n${content}`;

const sendReply = async ({ message, socket }, content, options) => {
  const chatId = message?.key?.remoteJid;
  if (!chatId) {
    throw new Error('Cannot send command response: chat ID is unavailable.');
  }
  if (typeof socket?.sendMessage !== 'function') {
    throw new Error('Cannot send command response: WhatsApp socket is unavailable.');
  }

  return sendCommandResponse(
    socket,
    message,
    {
      text: formatBotMessage(content),
      contextInfo: buildNewsletterContext(),
    },
    options,
  );
};

const formatUnavailable = (value) => value || 'Tidak tersedia';

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'Tidak tersedia';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

const formatDuration = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${days} hari, ${hours} jam, ${minutes} menit, ${remainingSeconds} detik`;
};

const formatCurrentTime = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat(config.time.locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: config.time.timezone,
    timeZoneName: 'short',
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || '';
  return `${part('hour')}:${part('minute')}:${part('second')} ${part('timeZoneName')}`.trim();
};

const formatCurrentDate = (date = new Date()) =>
  new Intl.DateTimeFormat(config.time.locale, {
    dateStyle: 'full',
    timeZone: config.time.timezone,
  }).format(date);

export {
  formatBotMessage,
  formatBytes,
  formatCurrentDate,
  formatCurrentTime,
  formatDuration,
  formatUnavailable,
  sendReply,
};
