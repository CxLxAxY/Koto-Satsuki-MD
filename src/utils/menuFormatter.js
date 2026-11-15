import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { getHeapStatistics } from 'node:v8';
import config from '../config/config.js';
import { sendCommandResponse } from '../core/messageSender.js';
import { buildNewsletterContext } from './newsletterContext.js';
import { isValidPhoneNumber } from './senderResolver.js';

const MAX_CAPTION_LENGTH = 1024;
const CAPTION_TRUNCATION_NOTICE = '\n… Menu dipersingkat agar sesuai batas caption WhatsApp.';

const cleanText = (value) =>
  typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/gu, ' ').replace(/\s+/gu, ' ').trim()
    : '';

const normalizeCategorySlug = (category) =>
  typeof category === 'string'
    ? category
        .normalize('NFKD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/^-|-$/gu, '')
    : '';

const formatGigabytes = (bytes) => `${(bytes / 1024 ** 3).toFixed(2)} GB`;

const readCgroupMemoryLimit = async () => {
  if (process.platform !== 'linux') {
    return undefined;
  }

  const cgroupFiles = [
    '/sys/fs/cgroup/memory.max',
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
  ];

  for (const filePath of cgroupFiles) {
    let value;
    try {
      value = (await readFile(filePath, 'utf8')).trim();
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'EPERM') {
        continue;
      }
      throw error;
    }

    if (!value || value.toLowerCase() === 'max') {
      continue;
    }
    const bytes = Number(value);
    if (Number.isFinite(bytes) && bytes > 0 && bytes < 1e15) {
      return bytes;
    }
  }

  return undefined;
};

const getMemoryInfo = async () => {
  const usage = process.memoryUsage();
  const cgroupLimit = await readCgroupMemoryLimit();
  const hostMemory = os.totalmem();
  const heapLimit = getHeapStatistics().heap_size_limit;

  return {
    rss: usage.rss,
    total: cgroupLimit || hostMemory,
    totalSource: cgroupLimit ? 'container limit' : 'host total',
    heapUsed: usage.heapUsed,
    heapLimit,
  };
};

const getCategories = (commands) => {
  const counts = new Map();
  for (const command of commands) {
    if (command.enabled === false || typeof command.category !== 'string') {
      continue;
    }
    const name = cleanText(command.category);
    const slug = normalizeCategorySlug(name);
    if (slug) {
      const current = counts.get(slug);
      if (current) {
        current.count += 1;
      } else {
        counts.set(slug, { name, count: 1, slug });
      }
    }
  }
  return [...counts.values()].sort((left, right) => left.slug.localeCompare(right.slug, 'en'));
};

const fitCaption = (caption) => {
  const characters = Array.from(caption);
  if (characters.length <= MAX_CAPTION_LENGTH) {
    return caption;
  }
  const notice = Array.from(CAPTION_TRUNCATION_NOTICE);
  return `${characters
    .slice(0, MAX_CAPTION_LENGTH - notice.length)
    .join('')
    .trimEnd()}${CAPTION_TRUNCATION_NOTICE}`;
};

const formatMenuCaption = async ({ botNumber, commands, prefix }) => {
  const memory = await getMemoryInfo();
  const creatorName = cleanText(config.identity.creatorName);
  const creatorContactUrl = cleanText(config.identity.creatorContactUrl);
  const ownerNumber = isValidPhoneNumber(config.identity.ownerNumber)
    ? config.identity.ownerNumber
    : '';
  const safeBotNumber = isValidPhoneNumber(botNumber) ? botNumber : 'UNAVAILABLE';

  const information = [
    ['Creator', creatorName],
    ['Contact Creator', creatorContactUrl],
    ['Library', cleanText(config.identity.library)],
    ['Version', cleanText(config.identity.version)],
    ['Language', cleanText(config.identity.language)],
    ['Owner Name', cleanText(config.identity.ownerName)],
    ['Owner Number', ownerNumber],
    ['Bot Number', safeBotNumber],
    ['Bot Mode', cleanText(config.identity.mode)],
    [
      'Memory',
      `${formatGigabytes(memory.rss)} RSS / ${formatGigabytes(memory.total)} ${memory.totalSource}; Heap ${formatGigabytes(memory.heapUsed)} / ${formatGigabytes(memory.heapLimit)} V8`,
    ],
    ['Contact', cleanText(config.identity.ownerContactUrl)],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `│ >> ${label} : ${value}`);

  const categories = getCategories(commands);
  const categoryLines = categories.map(
    ({ name, count }) => `│ >> ${name} (${count} ${count === 1 ? 'command' : 'commands'})`,
  );
  const categoryPanel =
    categoryLines.length > 0
      ? [
          '╭──( CATEGORY )──',
          ...categoryLines,
          '╰━━━━━━━━━━━━━━━━',
        ].join('\n')
      : '';
  const panels = [
    `—( ${cleanText(config.identity.botName)} )—`,
    [
      '╭──( INFORMATION )──',
      ...information,
      '╰━━━━━━━━━━━━━━━━',
    ].join('\n'),
    categoryPanel,
    `Tip: Gunakan ${prefix}menucat <kategori>\nuntuk melihat daftar commands di dalam kategori.\n\nContoh:\n${prefix}menucat general`,
  ].filter(Boolean);

  return fitCaption(panels.join('\n\n'));
};

const formatCategoryCommands = ({ category, commands, prefix }) =>
  [
    `╭──( ${cleanText(category).toUpperCase()} COMMANDS )──`,
    '│',
    ...commands
      .filter((command) => command.enabled !== false)
      .map((command) => `│ ${prefix}${command.name}`),
    '│',
    '╰━━━━━━━━━━━━━━━━━━━━━━',
    `Total: ${commands.filter((command) => command.enabled !== false).length} commands`,
  ].join('\n');

const executeMenu = async (
  { message, prefix, socket },
  { botNumber, commands, imageEnabled, imageLoader, imageName, logger },
) => {
  const commandMessage = message;
  const chatId = commandMessage?.key?.remoteJid;
  if (!chatId) {
    throw new Error('Cannot send menu: chat ID is unavailable.');
  }
  if (typeof socket?.sendMessage !== 'function') {
    throw new Error('Cannot send menu: WhatsApp socket is unavailable.');
  }

  const caption = await formatMenuCaption({ botNumber, commands, prefix });
  logger.media(imageName);
  if (!imageEnabled) {
    logger.warning('Menu image is disabled; sending the caption as text.');
    return sendCommandResponse(socket, commandMessage, {
      text: caption,
      contextInfo: buildNewsletterContext(),
    });
  }

  let image;
  try {
    image = await imageLoader();
  } catch (error) {
    if (!error || error.code !== 'MENU_IMAGE_UNAVAILABLE') {
      throw error;
    }
    logger.warning(`Menu image is unavailable (${error.message}); sending a text fallback.`);
    return sendCommandResponse(socket, commandMessage, {
      text: caption,
      contextInfo: buildNewsletterContext(),
    });
  }

  return sendCommandResponse(socket, commandMessage, {
    image: image.buffer,
    mimetype: image.mimeType,
    caption,
    contextInfo: buildNewsletterContext(),
  });
};

export {
  executeMenu,
  formatCategoryCommands,
  formatMenuCaption,
  getCategories,
  getMemoryInfo,
  normalizeCategorySlug,
  readCgroupMemoryLimit,
};
