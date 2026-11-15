const VIEW_ONCE_KEYS = new Set([
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
]);
const GROUP_JID_PATTERN = /^\d+(?:-\d+)?@g\.us$/u;
const USER_JID_PATTERN = /^[^@\s]{1,128}@(s\.whatsapp\.net|lid)$/u;

const unwrapTextMessage = (message) => {
  let content = message;
  for (let depth = 0; depth < 6 && content && typeof content === 'object'; depth += 1) {
    if (Object.keys(content).some((key) => VIEW_ONCE_KEYS.has(key))) {
      return undefined;
    }
    const wrapper = ['ephemeralMessage', 'documentWithCaptionMessage', 'editedMessage']
      .find((key) => content[key]?.message);
    if (!wrapper) {
      return content;
    }
    content = content[wrapper].message;
  }
  return undefined;
};

const getTimestamp = (message) => {
  const rawTimestamp = message?.messageTimestamp;
  const seconds = Number(
    typeof rawTimestamp?.toNumber === 'function'
      ? rawTimestamp.toNumber()
      : rawTimestamp,
  );
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return undefined;
  }
  const timestamp = new Date(seconds * 1000);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : undefined;
};

const normalizeWhatsAppTextMessage = (message, { prefix = '.' } = {}) => {
  const key = message?.key;
  const chatJid = key?.remoteJid;
  const senderJid =
    key?.participant ||
    key?.participantPn ||
    key?.participantLid ||
    key?.senderPn ||
    key?.senderLid ||
    chatJid;
  const content = unwrapTextMessage(message?.message);
  const text =
    typeof content?.conversation === 'string'
      ? content.conversation
      : typeof content?.extendedTextMessage?.text === 'string'
        ? content.extendedTextMessage.text
        : '';

  if (
    key?.fromMe ||
    typeof key?.id !== 'string' ||
    !key.id ||
    key.id.length > 256 ||
    typeof chatJid !== 'string' ||
    !(GROUP_JID_PATTERN.test(chatJid) || USER_JID_PATTERN.test(chatJid)) ||
    typeof senderJid !== 'string' ||
    !USER_JID_PATTERN.test(senderJid) ||
    !text.trim() ||
    text.length > 4096 ||
    text.trimStart().startsWith(prefix)
  ) {
    return undefined;
  }

  const timestamp = getTimestamp(message);
  if (!timestamp) {
    return undefined;
  }
  return {
    messageId: key.id,
    chatJid,
    senderJid,
    text,
    timestamp,
  };
};

export { normalizeWhatsAppTextMessage };
