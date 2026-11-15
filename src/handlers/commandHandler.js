import config from '../config/config.js';
import { createCommandSocket } from '../core/messageSender.js';
import logger from '../utils/logger.js';
import { normalizeCategorySlug } from '../utils/menuFormatter.js';
import { sendReply } from '../utils/formatter.js';
import { normalizeCommandText } from '../utils/messageParser.js';

const commandRegistry = new Map();
const commandLookup = new Map();

class CommandValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CommandValidationError';
  }
}

const normalizeCommandName = (command) => {
  if (typeof command !== 'string' || !/^[\w-]+$/u.test(command.trim())) {
    throw new Error('Command names may only contain letters, numbers, underscores, and hyphens');
  }
  return command.trim().toLowerCase();
};

const registerCommand = (command) => {
  if (!command || typeof command !== 'object' || typeof command.execute !== 'function') {
    throw new Error('A command must define metadata and an execute function');
  }
  if (
    typeof command.description !== 'string' ||
    typeof command.category !== 'string' ||
    command.category.trim().length === 0 ||
    !normalizeCategorySlug(command.category) ||
    typeof command.usage !== 'string'
  ) {
    throw new Error('A command must define description, category, and usage metadata');
  }
  if (command.enabled !== undefined && typeof command.enabled !== 'boolean') {
    throw new Error('Command enabled metadata must be a boolean');
  }
  if (command.redactArguments !== undefined && typeof command.redactArguments !== 'boolean') {
    throw new Error('Command redactArguments metadata must be a boolean');
  }
  if (command.redactSender !== undefined && typeof command.redactSender !== 'boolean') {
    throw new Error('Command redactSender metadata must be a boolean');
  }
  if (command.aliases !== undefined && !Array.isArray(command.aliases)) {
    throw new Error('Command aliases must be an array');
  }

  const name = normalizeCommandName(command.name);
  const aliases = (command.aliases || []).map(normalizeCommandName);
  const names = [name, ...aliases];
  if (new Set(names).size !== names.length) {
    throw new Error(`Command "${name}" has duplicate aliases`);
  }
  for (const commandName of names) {
    if (commandLookup.has(commandName)) {
      throw new Error(`Command "${commandName}" is already registered`);
    }
  }

  const registeredCommand = Object.freeze({
    ...command,
    name,
    aliases: Object.freeze(aliases),
  });
  commandRegistry.set(name, registeredCommand);
  for (const commandName of names) {
    commandLookup.set(commandName, registeredCommand);
  }
  return registeredCommand;
};

const getCommand = (name) => {
  if (typeof name !== 'string') {
    return undefined;
  }
  const command = commandLookup.get(name.trim().toLowerCase());
  return command?.enabled === false ? undefined : command;
};

const getCommands = ({ includeDisabled = false } = {}) =>
  [...commandRegistry.values()].filter(
    (command) => includeDisabled || command.enabled !== false,
  );

const getCommandsByCategory = (categorySlug, { includeDisabled = false } = {}) => {
  const normalizedSlug = normalizeCategorySlug(categorySlug);
  if (!normalizedSlug) {
    return [];
  }
  return getCommands({ includeDisabled }).filter(
    (command) => normalizeCategorySlug(command.category) === normalizedSlug,
  );
};

const getCategories = () => {
  const categories = new Map();
  for (const command of getCommands()) {
    const slug = normalizeCategorySlug(command.category);
    const current = categories.get(slug);
    if (current) {
      current.count += 1;
    } else {
      categories.set(slug, { name: command.category, slug, count: 1 });
    }
  }
  return [...categories.values()].sort((left, right) =>
    left.slug.localeCompare(right.slug, 'en'),
  );
};

const handleCommand = async ({
  text,
  prefix = config.command.prefix,
  sender = 'UNRESOLVED',
  chatType = 'UNKNOWN',
  message,
  socket,
  senderInfo,
  resolveParticipant,
  connectionState = 'UNKNOWN',
  authStatus = 'UNKNOWN',
  receivedAt = performance.now(),
}) => {
  const normalized = normalizeCommandText(text, prefix);
  if (!normalized.isCommand) {
    return { handled: false };
  }

  const command = getCommand(normalized.command);
  if (!command) {
    logger.command(`${prefix}${normalized.command}`);
    logger.sender('[REDACTED]');
    logger.chat(chatType);
    logger.status('WARNING');
    logger.warning(`Unknown command or category: ${normalized.command}`);
    try {
      await sendReply(
        { message, socket },
        `Command "${normalized.command}" tidak ditemukan. Gunakan ${prefix}menu untuk melihat command yang tersedia.`,
      );
      return { handled: true, executed: false, reason: 'unknown_command' };
    } catch (error) {
      logger.error('Failed to send unknown-command response.', error);
      return { handled: true, executed: false, reason: 'unknown_command', error };
    }
  }

  const startedAt = performance.now();
  const senderValue =
    message && typeof sender === 'string' && sender.trim().length > 0
      ? sender.trim()
      : '[REDACTED]';
  logger.command(`${prefix}${command.name}`);
  if (normalized.args.length > 0) {
    logger.arguments(command.redactArguments ? '[REDACTED]' : normalized.args.join(' '));
  }
  const loggedCategory =
    command.name === 'menucat'
      ? normalized.args.join(' ').trim().toUpperCase() || 'UNSPECIFIED'
      : command.category.toUpperCase();
  logger.commandCategory(loggedCategory);
  logger.sender(senderValue);
  logger.chat(chatType);
  logger.status('PROCESSING');

  try {
    const result = await command.execute({
      args: normalized.args,
      authStatus,
      chatType,
      command,
      connectionState,
      message,
      prefix,
      receivedAt,
      sender,
      senderInfo,
      resolveParticipant,
      socket: createCommandSocket(socket, message),
    });
    logger.status('SUCCESS');
    logger.duration(Math.round(performance.now() - startedAt));
    return { handled: true, executed: true, result };
  } catch (error) {
    logger.status('FAILED');
    logger.duration(Math.round(performance.now() - startedAt));
    if (error instanceof CommandValidationError) {
      logger.warning(`Command ${prefix}${command.name} validation failed: ${error.message}`);
      return {
        handled: true,
        executed: false,
        reason: 'validation_error',
        error,
      };
    }
    if (error?.code === 'GLOBAL_MESSAGE_SEND_FAILED') {
      return { handled: true, executed: false, error };
    }
    logger.error(`Command ${prefix}${command.name} failed.`, error);
    try {
      await sendReply({ message, socket }, 'Command gagal diproses. Silakan coba lagi nanti.');
    } catch (replyError) {
      logger.error('Failed to send command failure response.', replyError);
    }
    return { handled: true, executed: false, error };
  }
};

export {
  CommandValidationError,
  getCategories,
  getCommand,
  getCommands,
  getCommandsByCategory,
  handleCommand,
  registerCommand,
};
export default {
  CommandValidationError,
  getCategories,
  getCommand,
  getCommands,
  getCommandsByCategory,
  handleCommand,
  registerCommand,
};
