import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const GROUP_JID_PATTERN = /^\d+(?:-\d+)?@g\.us$/u;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const DEFAULT_WELCOME_TEMPLATE = 'Selamat datang {user} di grup {group}!';
const DEFAULT_GOODBYE_TEMPLATE =
  'Selamat tinggal {user}. Terima kasih telah menjadi bagian dari {group}.';
const MAX_TEMPLATE_LENGTH = 500;

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const clone = (value) => JSON.parse(JSON.stringify(value));

const validateTemplate = (value, label) => {
  if (
    typeof value !== 'string' ||
    value.trim().length === 0 ||
    value.length > MAX_TEMPLATE_LENGTH ||
    /[\u0000-\u0008\u000B-\u001F\u007F]/u.test(value)
  ) {
    throw new TypeError(`${label} must be a non-empty template up to ${MAX_TEMPLATE_LENGTH} characters.`);
  }
  return value.trim();
};

const createDefaultGroupConfig = () => ({
  welcome: {
    enabled: false,
    template: DEFAULT_WELCOME_TEMPLATE,
  },
  goodbye: {
    enabled: false,
    template: DEFAULT_GOODBYE_TEMPLATE,
  },
  autoClose: {
    enabled: false,
    time: null,
    enabledAt: null,
    lastExecution: null,
  },
  autoOpen: {
    enabled: false,
    time: null,
    enabledAt: null,
    lastExecution: null,
  },
});

const validateSchedule = (schedule, label) => {
  if (!isRecord(schedule) || typeof schedule.enabled !== 'boolean') {
    throw new TypeError(`${label} schedule must contain a boolean enabled field.`);
  }
  if (schedule.time !== null && !TIME_PATTERN.test(schedule.time || '')) {
    throw new TypeError(`${label} schedule time must use HH:mm or null.`);
  }
  if (
    schedule.enabledAt !== null &&
    (typeof schedule.enabledAt !== 'string' || !Number.isFinite(Date.parse(schedule.enabledAt)))
  ) {
    throw new TypeError(`${label} schedule enabledAt must be an ISO timestamp or null.`);
  }
  if (
    schedule.lastExecution !== null &&
    (!isRecord(schedule.lastExecution) ||
      typeof schedule.lastExecution.date !== 'string' ||
      typeof schedule.lastExecution.status !== 'string' ||
      typeof schedule.lastExecution.at !== 'string')
  ) {
    throw new TypeError(`${label} schedule lastExecution is invalid.`);
  }
  if (schedule.enabled && (!schedule.time || !schedule.enabledAt)) {
    throw new TypeError(`${label} schedule cannot be enabled without a time and enabledAt.`);
  }
};

const validateGroupConfig = (value) => {
  if (!isRecord(value)) {
    throw new TypeError('Group configuration must be an object.');
  }
  if (
    !isRecord(value.welcome) ||
    typeof value.welcome.enabled !== 'boolean' ||
    !isRecord(value.goodbye) ||
    typeof value.goodbye.enabled !== 'boolean'
  ) {
    throw new TypeError('Group welcome and goodbye settings are invalid.');
  }
  const config = {
    welcome: {
      enabled: value.welcome.enabled,
      template: validateTemplate(value.welcome.template, 'Welcome template'),
    },
    goodbye: {
      enabled: value.goodbye.enabled,
      template: validateTemplate(value.goodbye.template, 'Goodbye template'),
    },
    autoClose: value.autoClose,
    autoOpen: value.autoOpen,
  };
  validateSchedule(config.autoClose, 'Auto-close');
  validateSchedule(config.autoOpen, 'Auto-open');
  if (
    config.autoClose.time &&
    config.autoClose.time === config.autoOpen.time
  ) {
    throw new TypeError('Auto-close and auto-open cannot use the same time.');
  }
  return config;
};

const validateDatabase = (value) => {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.groups)) {
    throw new TypeError('Group configuration file has an unsupported or invalid format.');
  }
  const groups = {};
  for (const [groupJid, config] of Object.entries(value.groups)) {
    if (!GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group configuration file contains an invalid group JID.');
    }
    groups[groupJid] = validateGroupConfig(config);
  }
  return { version: 1, groups };
};

class GroupConfigStore {
  constructor(filePath) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new TypeError('Group configuration file path must be a non-empty string.');
    }
    this.filePath = filePath;
    this.database = { version: 1, groups: {} };
    this.loadPromise = undefined;
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (this.loadPromise) {
      return this.loadPromise;
    }
    this.loadPromise = (async () => {
      try {
        const content = await readFile(this.filePath, 'utf8');
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (cause) {
          throw new Error('Group configuration file contains invalid JSON.', { cause });
        }
        this.database = validateDatabase(parsed);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.loadPromise = undefined;
          throw error;
        }
        this.database = { version: 1, groups: {} };
      }
      return this;
    })();
    return this.loadPromise;
  }

  async get(groupJid) {
    this.assertGroupJid(groupJid);
    await this.load();
    return clone(this.database.groups[groupJid] || createDefaultGroupConfig());
  }

  async getAll() {
    await this.load();
    return Object.entries(this.database.groups).map(([groupJid, config]) => ({
      groupJid,
      config: clone(config),
    }));
  }

  async update(groupJid, updater) {
    this.assertGroupJid(groupJid);
    if (typeof updater !== 'function') {
      throw new TypeError('Group configuration updater must be a function.');
    }
    await this.load();

    const operation = this.writeQueue.then(async () => {
      const current = clone(
        this.database.groups[groupJid] || createDefaultGroupConfig(),
      );
      const nextConfig = validateGroupConfig(await updater(current));
      const nextDatabase = {
        version: 1,
        groups: {
          ...this.database.groups,
          [groupJid]: nextConfig,
        },
      };
      await this.persist(nextDatabase);
      this.database = nextDatabase;
      return clone(nextConfig);
    });
    this.writeQueue = operation.catch(() => undefined);
    return operation;
  }

  assertGroupJid(groupJid) {
    if (typeof groupJid !== 'string' || !GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group JID must be a valid WhatsApp group JID.');
    }
  }

  async persist(database) {
    const directory = dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await mkdir(directory, { recursive: true });
    try {
      await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temporaryPath, this.filePath);
    } catch (error) {
      try {
        await rm(temporaryPath, { force: true });
      } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') {
          throw new AggregateError(
            [error, cleanupError],
            'Failed to persist group configuration and clean up its temporary file.',
          );
        }
      }
      throw error;
    }
  }
}

const createGroupConfigStore = (filePath) => new GroupConfigStore(filePath);

export {
  DEFAULT_GOODBYE_TEMPLATE,
  DEFAULT_WELCOME_TEMPLATE,
  GroupConfigStore,
  TIME_PATTERN,
  createDefaultGroupConfig,
  createGroupConfigStore,
  validateGroupConfig,
};
