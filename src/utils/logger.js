import config from '../config/config.js';

const COLORS = {
  SYSTEM: '\u001b[36m',
  AUTH: '\u001b[35m',
  WHATSAPP: '\u001b[32m',
  CONNECTION: '\u001b[33m',
  RECONNECT: '\u001b[33m',
  COMMAND: '\u001b[34m',
  MEDIA: '\u001b[35m',
  CHANNEL: '\u001b[36m',
  CTA: '\u001b[36m',
  'CTA URL': '\u001b[36m',
  'CTA STATUS': '\u001b[36m',
  DELIVERY: '\u001b[36m',
  CATEGORY: '\u001b[36m',
  ARGS: '\u001b[34m',
  SENDER: '\u001b[33m',
  CHAT: '\u001b[33m',
  STATUS: '\u001b[32m',
  DURATION: '\u001b[90m',
  PAIRING: '\u001b[35m',
  ERROR: '\u001b[31m',
  WARNING: '\u001b[33m',
};

const LEVEL_ORDER = {
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
};

const sanitize = (message) =>
  String(message).replace(/[\u0000-\u0008\u000B-\u001F\u007F]/gu, '');

class Logger {
  shouldLog(level) {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[config.log.level];
  }

  format(category, message) {
    const timestamp = new Date().toTimeString().slice(0, 8);
    const label = `[${category}]`;
    const line = `${timestamp} ${label} ${sanitize(message)}`;
    if (!process.stdout.isTTY) {
      return line;
    }
    const statusColor =
      category === 'STATUS'
        ? message === 'FAILED'
          ? COLORS.ERROR
          : message === 'WARNING'
            ? COLORS.WARNING
            : message === 'PROCESSING'
              ? COLORS.COMMAND
              : '\u001b[32m'
        : category === 'CTA STATUS' && message.endsWith('FAILED')
          ? COLORS.ERROR
        : undefined;
    const color = statusColor || COLORS[category] || COLORS.SYSTEM;
    return `${color}${line}\u001b[0m`;
  }

  write(level, category, message) {
    if (!this.shouldLog(level)) {
      return;
    }
    const line = this.format(category, String(message));
    if (level === 'ERROR') {
      console.error(line);
      return;
    }
    console.log(line);
  }

  system(message) {
    this.write('INFO', 'SYSTEM', message);
  }

  auth(message) {
    this.write('INFO', 'AUTH', message);
  }

  pairing(code) {
    const line = this.format('PAIRING', `Pairing code (displayed once): ${code}`);
    console.log(line);
  }

  whatsapp(message) {
    this.write('INFO', 'WHATSAPP', message);
  }

  connection(message) {
    this.write('INFO', 'CONNECTION', message);
  }

  reconnect(message) {
    this.write('INFO', 'RECONNECT', message);
  }

  command(message) {
    this.write('INFO', 'COMMAND', message);
  }

  commandCategory(message) {
    this.write('INFO', 'CATEGORY', message);
  }

  media(message) {
    this.write('INFO', 'MEDIA', message);
  }

  channel(message) {
    this.write('INFO', 'CHANNEL', message);
  }

  cta(message) {
    this.write('INFO', 'CTA', message);
  }

  ctaUrlConfigured() {
    this.write('INFO', 'CTA URL', 'CONFIGURED');
  }

  ctaStatus(message) {
    this.write(
      message === 'FAILED' || message.endsWith('FAILED') ? 'ERROR' : 'INFO',
      'CTA STATUS',
      message,
    );
  }

  delivery(message) {
    this.write('INFO', 'DELIVERY', message);
  }

  arguments(message) {
    this.write('INFO', 'ARGS', message);
  }

  sender(message) {
    this.write('INFO', 'SENDER', message);
  }

  chat(message) {
    this.write('INFO', 'CHAT', message);
  }

  status(message) {
    const level = message === 'FAILED' ? 'ERROR' : message === 'WARNING' ? 'WARN' : 'INFO';
    this.write(level, message === 'WARNING' ? 'WARNING' : 'STATUS', message);
  }

  duration(milliseconds) {
    this.write('INFO', 'DURATION', `${milliseconds}ms`);
  }

  warning(message) {
    this.write('WARN', 'WARNING', message);
  }

  error(message, error) {
    const detail = error instanceof Error ? error.stack || error.message : '';
    this.write('ERROR', 'ERROR', detail ? `${message}\n${detail}` : message);
  }

  debug(message) {
    this.write('DEBUG', 'SYSTEM', message);
  }
}

const logger = new Logger();

export default logger;
