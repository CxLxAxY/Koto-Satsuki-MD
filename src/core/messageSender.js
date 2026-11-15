import { proto } from '@whiskeysockets/baileys';
import { mergeNewsletterContext } from '../utils/newsletterContext.js';
import logger from '../utils/logger.js';

const rawSockets = new WeakMap();

const isObject = (value) =>
  value !== null && (typeof value === 'object' || typeof value === 'function');

const getRawSocket = (socket) =>
  isObject(socket) ? rawSockets.get(socket) || socket : socket;

const getSentMessageId = (message) => {
  const messageId = message?.key?.id;
  if (typeof messageId !== 'string' || messageId.length === 0) {
    throw new Error(
      'Baileys did not return a message ID; delivery is unknown and no retry was attempted.',
    );
  }
  return messageId;
};

const observeMessageDelivery = (socket, messageId) => {
  const events = socket?.ev;
  if (
    typeof messageId !== 'string' ||
    typeof events?.on !== 'function' ||
    typeof events?.off !== 'function'
  ) {
    logger.delivery('Acknowledgement events are unavailable for this socket.');
    return;
  }

  let timer;
  const cleanup = () => {
    if (timer) {
      clearTimeout(timer);
    }
    events.off('messages.update', handleMessagesUpdate);
    events.off('message-receipt.update', handleMessageReceiptUpdate);
  };
  const handleMessagesUpdate = (updates) => {
    for (const { key, update } of Array.isArray(updates) ? updates : []) {
      if (key?.id !== messageId || key.fromMe === false || update?.status === undefined) {
        continue;
      }

      const status =
        typeof update.status === 'number'
          ? proto.WebMessageInfo.Status[update.status] || String(update.status)
          : String(update.status);
      logger.delivery(
        `${status === 'SERVER_ACK' ? 'ACK_RECEIVED' : 'DELIVERY_STATUS'} status=${status} message_id=${messageId}.`,
      );
      if (['ERROR', 'DELIVERY_ACK', 'READ', 'PLAYED'].includes(status)) {
        cleanup();
      }
    }
  };
  const handleMessageReceiptUpdate = (updates) => {
    for (const { key, receipt } of Array.isArray(updates) ? updates : []) {
      if (key?.id !== messageId || key.fromMe === false) {
        continue;
      }

      const status = receipt?.playedTimestamp !== undefined
        ? 'PLAYED'
        : receipt?.readTimestamp !== undefined
          ? 'READ'
          : receipt?.receiptTimestamp !== undefined
            ? 'DELIVERY_ACK'
            : String(receipt?.type || 'RECEIPT');
      logger.delivery(`DELIVERY_STATUS status=${status} message_id=${messageId}.`);
      cleanup();
    }
  };

  events.on('messages.update', handleMessagesUpdate);
  events.on('message-receipt.update', handleMessageReceiptUpdate);
  logger.delivery(`Acknowledgement observer attached for message_id=${messageId}.`);
  timer = setTimeout(() => {
    cleanup();
    logger.delivery(`No acknowledgement update observed within 30000ms for message_id=${messageId}.`);
  }, 30000);
  timer.unref?.();
};

const createSendError = (cause) => {
  const error = new Error('Failed to send command response through the global message sender.', {
    cause,
  });
  error.code = 'GLOBAL_MESSAGE_SEND_FAILED';
  return error;
};

const sendAutomatedMessage = async (socket, groupJid, content, options) => {
  if (typeof groupJid !== 'string' || !groupJid.endsWith('@g.us')) {
    throw new TypeError('Automated group notifications require a group JID.');
  }
  const rawSocket = getRawSocket(socket);
  if (typeof rawSocket?.sendMessage !== 'function') {
    throw new Error('Cannot send automated group notification: WhatsApp socket is unavailable.');
  }
  if (
    options !== undefined &&
    (!options ||
      typeof options !== 'object' ||
      Array.isArray(options) ||
      Object.hasOwn(options, 'quoted'))
  ) {
    throw new TypeError('Automated group notification options must not include a quoted command.');
  }

  const payload = mergeNewsletterContext(content);
  try {
    return await rawSocket.sendMessage(groupJid, payload, options);
  } catch (cause) {
    const error = new Error('Failed to send an automated group notification.', { cause });
    error.code = 'AUTOMATED_GROUP_MESSAGE_SEND_FAILED';
    throw error;
  }
};

const sendCommandResponse = async (socket, commandMessage, content, options) => {
  const jid = commandMessage?.key?.remoteJid;
  const commandMessageId = commandMessage?.key?.id;
  if (
    !commandMessage?.message ||
    typeof commandMessage.message !== 'object' ||
    !jid ||
    typeof jid !== 'string' ||
    typeof commandMessageId !== 'string' ||
    commandMessageId.length === 0 ||
    commandMessage.key.fromMe === true
  ) {
    throw new Error('Cannot send command response: original command message is unavailable.');
  }

  const rawSocket = getRawSocket(socket);
  if (typeof rawSocket?.sendMessage !== 'function') {
    throw new Error('Cannot send command response: WhatsApp socket is unavailable.');
  }
  if (options !== undefined && (!options || typeof options !== 'object' || Array.isArray(options))) {
    throw new TypeError('Command send options must be an object.');
  }

  const payload = mergeNewsletterContext(content);
  const sendOptions = {
    ...(options || {}),
    quoted: commandMessage,
  };
  const body =
    typeof payload.text === 'string'
      ? payload.text
      : typeof payload.caption === 'string'
        ? payload.caption
        : '';
  logger.delivery(
    `Command response prepared: body_empty=${body.trim().length === 0} body_length=${Array.from(body).length}.`,
  );

  try {
    const message = await rawSocket.sendMessage(jid, payload, sendOptions);
    const messageId = getSentMessageId(message);
    logger.delivery(`Command response relay accepted: message_id=${messageId}.`);
    observeMessageDelivery(rawSocket, messageId);
    return message;
  } catch (cause) {
    logger.error('Global command response delivery failed.', cause);
    throw createSendError(cause);
  }
};

const createCommandSocket = (socket, commandMessage) => {
  if (!isObject(socket)) {
    return socket;
  }

  let commandSocket;
  const sendMessage = (jid, content, options) => {
    if (jid !== commandMessage?.key?.remoteJid) {
      throw new Error('Command responses must be sent to the originating chat.');
    }
    return sendCommandResponse(commandSocket, commandMessage, content, options);
  };
  commandSocket = new Proxy(socket, {
    get(target, property) {
      if (property === 'sendMessage') {
        return sendMessage;
      }
      if (property === 'relayMessage') {
        return async () => {
          throw new Error(
            'Command output must use sendMessage() so Baileys can quote the original command.',
          );
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  rawSockets.set(commandSocket, socket);
  return commandSocket;
};

export {
  createCommandSocket,
  sendAutomatedMessage,
  sendCommandResponse,
};
