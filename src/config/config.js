import dotenv from 'dotenv';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePhoneNumber } from '../utils/senderResolver.js';

dotenv.config();

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const resolvePath = (value, fallback) => {
  const path = value || fallback;
  return isAbsolute(path) ? path : resolve(projectRoot, path);
};

const parsePositiveInteger = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

const parseBoolean = (name, fallback) => {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }
  if (normalized === 'false') {
    return false;
  }
  throw new Error(`${name} must be either "true" or "false"`);
};

const parseOptionalHttpUrl = (name) => {
  const value = (process.env[name] || '').trim();
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password &&
      url.href.length <= 2048
    ) {
      return url.href;
    }
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL.`);
  }
  throw new Error(`${name} must be a valid HTTP(S) URL.`);
};

const parseNewsletterConfiguration = () => {
  const channelId = (process.env.BOT_CHANNEL_ID || '').trim();
  const channelName = (process.env.BOT_CHANNEL_NAME || '').trim();
  const channelNameValid =
    channelName.length <= 80 && !/[\u0000-\u001F\u007F]/u.test(channelName);

  return Object.freeze({
    id: /^\d+@newsletter$/u.test(channelId) ? channelId : '',
    idConfigured: Boolean(channelId),
    idValid: /^\d+@newsletter$/u.test(channelId),
    name: channelNameValid ? channelName : '',
    serverMessageId: parsePositiveInteger('BOT_CHANNEL_SERVER_MESSAGE_ID', 100),
  });
};

const logLevel = (process.env.LOG_LEVEL || 'INFO').trim().toUpperCase();
const supportedLogLevels = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']);
if (!supportedLogLevels.has(logLevel)) {
  throw new Error(`LOG_LEVEL must be one of: ${[...supportedLogLevels].join(', ')}`);
}

const prefix = process.env.COMMAND_PREFIX ?? '.';
if (prefix.length === 0 || /\s/.test(prefix)) {
  throw new Error('COMMAND_PREFIX must be a non-empty string without whitespace');
}

const timezone = (process.env.TIMEZONE || '').trim();
const language = (process.env.LANGUAGE || '').trim();
const channel = parseNewsletterConfiguration();

const config = Object.freeze({
  identity: {
    botName: (process.env.BOT_NAME || '').trim(),
    version: (process.env.BOT_VERSION || '').trim(),
    mode: (process.env.BOT_MODE || '').trim(),
    language: (process.env.BOT_LANGUAGE || '').trim(),
    library: (process.env.BOT_LIBRARY || '').trim(),
    creatorName: (process.env.CREATOR_NAME || '').trim(),
    creatorContactUrl: parseOptionalHttpUrl('CREATOR_CONTACT_URL'),
    ownerName: (process.env.OWNER_NAME || '').trim(),
    ownerNumber: normalizePhoneNumber(process.env.OWNER_NUMBER),
    ownerContactUrl: parseOptionalHttpUrl('OWNER_CONTACT_URL'),
  },
  channel,
  whatsapp: {
    phoneNumber: normalizePhoneNumber(process.env.WHATSAPP_PHONE_NUMBER),
  },
  paths: {
    auth: resolvePath(process.env.SESSION_FOLDER, './storage/auth'),
    groupConfig: resolvePath(process.env.GROUP_CONFIG_PATH, './storage/group-config.json'),
  },
  log: {
    level: logLevel,
  },
  command: {
    prefix,
  },
  time: {
    timezone,
    language,
    locale: language.toLowerCase() === 'id' ? 'id-ID' : language,
  },
  menu: {
    imagePath: resolvePath(process.env.MENU_IMAGE_PATH, './assets/menu.jpg'),
    imageEnabled: parseBoolean('MENU_IMAGE_ENABLED', true),
  },
  reconnect: {
    baseDelayMs: parsePositiveInteger('RECONNECT_BASE_DELAY_MS', 3000),
    maxDelayMs: parsePositiveInteger('RECONNECT_MAX_DELAY_MS', 30000),
    jitter: parseBoolean('RECONNECT_JITTER', true),
  },
});

if (config.reconnect.maxDelayMs < config.reconnect.baseDelayMs) {
  throw new Error('RECONNECT_MAX_DELAY_MS must be greater than or equal to RECONNECT_BASE_DELAY_MS');
}

const validateConfig = () => {
  const rawOwnerNumber = (process.env.OWNER_NUMBER || '').trim();
  if (rawOwnerNumber && !config.identity.ownerNumber) {
    throw new Error('OWNER_NUMBER must contain 8–15 digits including its country code.');
  }

  const requiredVariables = [
    ['BOT_NAME', config.identity.botName],
    ['BOT_VERSION', config.identity.version],
    ['BOT_MODE', config.identity.mode],
    ['BOT_LANGUAGE', config.identity.language],
    ['BOT_LIBRARY', config.identity.library],
    ['OWNER_NAME', config.identity.ownerName],
    ['OWNER_NUMBER', config.identity.ownerNumber],
    ['TIMEZONE', config.time.timezone],
    ['LANGUAGE', config.time.language],
  ];
  const missingVariables = requiredVariables
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingVariables.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVariables.join(', ')}`);
  }

  try {
    new Intl.DateTimeFormat(config.time.locale, { timeZone: config.time.timezone });
  } catch (error) {
    throw new Error('TIMEZONE or LANGUAGE is not supported by this Node.js runtime.', { cause: error });
  }

  return config;
};

export { validateConfig };
export default config;
