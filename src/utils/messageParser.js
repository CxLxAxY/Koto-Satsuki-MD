const normalizeCommandText = (text, prefix) => {
  if (typeof text !== 'string' || typeof prefix !== 'string' || prefix.length === 0) {
    return { isCommand: false, command: '', args: [] };
  }

  const normalizedText = text.trim();
  if (!normalizedText.startsWith(prefix)) {
    return { isCommand: false, command: '', args: [] };
  }

  const withoutPrefix = normalizedText.slice(prefix.length).trim();
  if (!withoutPrefix) {
    return { isCommand: false, command: '', args: [] };
  }

  const [command, ...args] = withoutPrefix.split(/\s+/u);
  return {
    isCommand: true,
    command: command.toLowerCase(),
    args,
  };
};

const extractMessageText = (message) => {
  let content = message;
  const wrapperKeys = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage',
  ];

  for (let depth = 0; depth < 6 && content && typeof content === 'object'; depth += 1) {
    const wrapper = wrapperKeys.find((key) => content[key]?.message);
    if (!wrapper) {
      break;
    }
    content = content[wrapper].message;
  }

  if (!content || typeof content !== 'object') {
    return '';
  }

  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.buttonsResponseMessage?.selectedButtonId ||
    content.listResponseMessage?.singleSelectReply?.selectedRowId ||
    content.templateButtonReplyMessage?.selectedId ||
    ''
  );
};

export { extractMessageText, normalizeCommandText };
export default {
  extractMessageText,
  normalizeCommandText,
};

