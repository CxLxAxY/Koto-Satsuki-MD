import config from '../config/config.js';
import logger from './logger.js';

const NEWSLETTER_JID_PATTERN = /^\d+@newsletter$/u;
let channelWarningLogged = false;

const getNewsletterSettings = () => ({
  channelId: config.channel.id,
  serverMessageId: config.channel.serverMessageId,
  channelName: config.channel.name,
  ownerName: config.identity.ownerName,
  botName: config.identity.botName,
});

const warnNewsletterUnavailable = () => {
  if (config.channel.idValid || channelWarningLogged) {
    return;
  }
  channelWarningLogged = true;
  const reason = config.channel.idConfigured ? 'invalid' : 'missing';
  logger.warning(`BOT_CHANNEL_ID is ${reason}; forwarded newsletter channel context is unavailable.`);
};

const buildNewsletterContext = (settings = getNewsletterSettings()) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new TypeError('Newsletter settings must be an object.');
  }

  const contextInfo = {
    forwardingScore: 2,
    isForwarded: true,
  };
  const channelId =
    typeof settings.channelId === 'string' ? settings.channelId.trim() : '';

  if (!NEWSLETTER_JID_PATTERN.test(channelId)) {
    warnNewsletterUnavailable();
    return contextInfo;
  }

  const serverMessageId =
    Number.isInteger(settings.serverMessageId) && settings.serverMessageId > 0
      ? settings.serverMessageId
      : 100;
  const newsletterName = [
    settings.channelName,
    settings.ownerName,
    settings.botName,
  ].find((value) => typeof value === 'string' && value.trim())?.trim() || 'Channel';

  contextInfo.forwardedNewsletterMessageInfo = {
    newsletterJid: channelId,
    serverMessageId,
    newsletterName,
  };
  return contextInfo;
};

const mergeNewsletterContext = (content, settings) => {
  const payload =
    typeof content === 'string'
      ? { text: content }
      : content && typeof content === 'object' && !Array.isArray(content)
        ? { ...content }
        : null;

  if (!payload) {
    throw new TypeError('Message content must be a string or message object.');
  }

  const existingContext =
    payload.contextInfo && typeof payload.contextInfo === 'object'
      ? payload.contextInfo
      : {};
  const newsletterContext = buildNewsletterContext(settings);

  return {
    ...payload,
    contextInfo: {
      ...existingContext,
      ...newsletterContext,
    },
  };
};

export {
  buildNewsletterContext,
  getNewsletterSettings,
  mergeNewsletterContext,
  warnNewsletterUnavailable,
};
