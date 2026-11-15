import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import logger from '../../utils/logger.js';

const GROUP_JID_PATTERN = /^\d+(?:-\d+)?@g\.us$/u;
const USER_JID_PATTERN = /^[^@\s]{1,128}@(s\.whatsapp\.net|lid)$/u;
const MAX_MESSAGES = 2000;
const MAX_CONSENTS = 10000;
const MAX_MEMBER_EVENTS = 20000;
const MAX_TRACKED_GROUPS = 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
const SKIP_MUTATION = Symbol('skip-mutation');

const createEmptyDatabase = () => ({
  version: 1,
  identityKey: randomBytes(32).toString('hex'),
  consents: {},
  memberConsents: {},
  messages: [],
  memberEvents: [],
});

const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validateDatabase = (database) => {
  if (
    !isRecord(database) ||
    database.version !== 1 ||
    typeof database.identityKey !== 'string' ||
    !/^[a-f\d]{64}$/u.test(database.identityKey) ||
    !isRecord(database.consents) ||
    !isRecord(database.memberConsents) ||
    !Array.isArray(database.messages) ||
    !Array.isArray(database.memberEvents)
  ) {
    throw new TypeError('WhatsApp data store has an unsupported or invalid format.');
  }
  if (
    database.messages.length > MAX_MESSAGES ||
    Object.keys(database.consents).length > MAX_CONSENTS ||
    Object.keys(database.memberConsents).length > MAX_TRACKED_GROUPS ||
    database.memberEvents.length > MAX_MEMBER_EVENTS ||
    database.messages.some(
      (item) =>
        !isRecord(item) ||
        typeof item.idHash !== 'string' ||
        typeof item.senderHash !== 'string' ||
        typeof item.chatJid !== 'string' ||
        typeof item.text !== 'string' ||
        typeof item.timestamp !== 'string' ||
        typeof item.collectedAt !== 'string',
    ) ||
    Object.values(database.consents).some(
      (item) =>
        !isRecord(item) ||
        typeof item.senderHash !== 'string',
    ) ||
    Object.entries(database.memberConsents).some(
      ([groupJid, consented]) =>
        !GROUP_JID_PATTERN.test(groupJid) || consented !== true,
    ) ||
    database.memberEvents.some(
      (item) =>
        !isRecord(item) ||
        !GROUP_JID_PATTERN.test(item.groupJid) ||
        !['add', 'remove', 'promote', 'demote'].includes(item.action) ||
        !Number.isInteger(item.count) ||
        item.count < 1 ||
        typeof item.at !== 'string',
    )
  ) {
    throw new TypeError('WhatsApp data store contains invalid records.');
  }
  return database;
};

class WhatsAppArchiveStore {
  constructor(filePath, { retentionDays = 30, now = Date.now } = {}) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new TypeError('WhatsApp data store path must be a non-empty string.');
    }
    if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
      throw new TypeError('WhatsApp data retention must be between 1 and 365 days.');
    }
    this.filePath = filePath;
    this.retentionDays = retentionDays;
    this.now = now;
    this.database = undefined;
    this.loadPromise = undefined;
    this.writeQueue = Promise.resolve();
    this.cleanupTimer = undefined;
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
          throw new Error('WhatsApp data store contains invalid JSON.', { cause });
        }
        this.database = validateDatabase(parsed);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.loadPromise = undefined;
          throw error;
        }
        this.database = createEmptyDatabase();
      }
      return this;
    })();
    return this.loadPromise;
  }

  async startRetentionCleanup() {
    await this.load();
    await this.pruneExpired();
    if (!this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        this.pruneExpired().catch((error) => {
          logger.error('WhatsApp archive retention cleanup failed.', error);
        });
      }, CLEANUP_INTERVAL_MS);
      this.cleanupTimer.unref?.();
    }
  }

  stopRetentionCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  async setConsent(identity, scope, enabled) {
    this.assertIdentityAndScope(identity, scope);
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Consent state must be a boolean.');
    }
    return this.mutate((database) => {
      const senderHash = this.hash(`identity\0${identity}`);
      const consentHash = this.hash(`consent\0${identity}\0${scope}`);
      if (enabled) {
        if (
          !database.consents[consentHash] &&
          Object.keys(database.consents).length >= MAX_CONSENTS
        ) {
          const error = new Error('WhatsApp consent storage has reached its configured limit.');
          error.code = 'CONSENT_LIMIT_REACHED';
          throw error;
        }
        database.consents[consentHash] = { senderHash };
      } else {
        delete database.consents[consentHash];
        database.messages = database.messages.filter(
          (item) =>
            item.senderHash !== senderHash || item.chatJid !== scope,
        );
      }
      return enabled;
    });
  }

  async hasConsent(identity, scope) {
    this.assertIdentityAndScope(identity, scope);
    await this.load();
    return Boolean(this.database.consents[this.hash(`consent\0${identity}\0${scope}`)]);
  }

  async recordMessage(identity, record) {
    this.assertIdentityAndScope(identity, record?.chatJid);
    if (
      typeof record.messageId !== 'string' ||
      record.messageId.length === 0 ||
      record.messageId.length > 256 ||
      typeof record.text !== 'string' ||
      record.text.length === 0 ||
      record.text.length > 4096 ||
      typeof record.timestamp !== 'string' ||
      !Number.isFinite(Date.parse(record.timestamp))
    ) {
      throw new TypeError('WhatsApp message record is invalid.');
    }

    if (!(await this.hasConsent(identity, record.chatJid))) {
      return { stored: false, reason: 'CONSENT_REQUIRED' };
    }

    const result = await this.mutate((database) => {
      const senderHash = this.hash(`identity\0${identity}`);
      if (
        !database.consents[this.hash(`consent\0${identity}\0${record.chatJid}`)]
      ) {
        return SKIP_MUTATION;
      }
      const idHash = this.hash(
        `message\0${record.chatJid}\0${record.messageId}`,
      );
      if (database.messages.some((item) => item.idHash === idHash)) {
        return { stored: false, reason: 'DUPLICATE' };
      }
      if (database.messages.length >= MAX_MESSAGES) {
        const error = new Error('WhatsApp archive has reached its configured record limit.');
        error.code = 'ARCHIVE_LIMIT_REACHED';
        throw error;
      }
      database.messages.push({
        idHash,
        senderHash,
        chatJid: record.chatJid,
        text: record.text,
        timestamp: record.timestamp,
        collectedAt: new Date(this.now()).toISOString(),
      });
      return { stored: true };
    });
    return result || { stored: false, reason: 'CONSENT_REQUIRED' };
  }

  async getUserMessages(identity, { limit = 20 } = {}) {
    this.assertIdentity(identity);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MESSAGES) {
      throw new TypeError(`Archive result limit must be between 1 and ${MAX_MESSAGES}.`);
    }
    await this.load();
    const senderHash = this.hash(`identity\0${identity}`);
    return this.database.messages
      .filter((item) => item.senderHash === senderHash)
      .slice(-limit)
      .map(({ chatJid, text, timestamp }) => ({ chatJid, text, timestamp }));
  }

  async deleteUserData(identity) {
    this.assertIdentity(identity);
    return this.mutate((database) => {
      const senderHash = this.hash(`identity\0${identity}`);
      const before = database.messages.length;
      database.messages = database.messages.filter(
        (item) => item.senderHash !== senderHash,
      );
      for (const consentHash of Object.keys(database.consents)) {
        if (database.consents[consentHash].senderHash === senderHash) {
          delete database.consents[consentHash];
        }
      }
      return before - database.messages.length;
    });
  }

  async recordMemberEvent(update) {
    const groupJid = update?.id;
    const action = update?.action;
    const participants = update?.participants;
    if (
      typeof groupJid !== 'string' ||
      !GROUP_JID_PATTERN.test(groupJid) ||
      !['add', 'remove', 'promote', 'demote'].includes(action) ||
      !Array.isArray(participants) ||
      participants.length === 0 ||
      participants.length > 100
    ) {
      return { stored: false, reason: 'INVALID_EVENT' };
    }
    const rawIdentities = participants
      .map((participant) =>
        typeof participant === 'string'
          ? participant
          : participant?.id || participant?.jid || participant?.participant,
      );
    if (
      rawIdentities.some(
        (jid) => typeof jid !== 'string' || !USER_JID_PATTERN.test(jid),
      )
    ) {
      return { stored: false, reason: 'INVALID_EVENT' };
    }
    const identities = [...new Set(rawIdentities)];

    const result = await this.mutate((database) => {
      if (database.memberConsents[groupJid] !== true) {
        return SKIP_MUTATION;
      }
      const now = this.now();
      if (
        database.memberEvents.length >= MAX_MEMBER_EVENTS ||
        (!database.memberEvents.some((item) => item.groupJid === groupJid) &&
          new Set(database.memberEvents.map((item) => item.groupJid)).size >=
            MAX_TRACKED_GROUPS)
      ) {
        const error = new Error('WhatsApp member statistics have reached their configured limit.');
        error.code = 'MEMBER_STATS_LIMIT_REACHED';
        throw error;
      }
      database.memberEvents.push({
        groupJid,
        action,
        count: identities.length,
        at: new Date(now).toISOString(),
      });
      return { stored: true };
    });
    return result || { stored: false, reason: 'CONSENT_REQUIRED' };
  }

  async getMemberStats(groupJid) {
    if (typeof groupJid !== 'string' || !GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group JID must be a valid WhatsApp group JID.');
    }
    await this.load();
    const events = this.database.memberEvents.filter(
      (item) => item.groupJid === groupJid,
    );
    const stats = {
      joined: 0,
      left: 0,
      promoted: 0,
      demoted: 0,
      netChange: 0,
    };
    for (const event of events) {
      const metric = {
        add: 'joined',
        remove: 'left',
        promote: 'promoted',
        demote: 'demoted',
      }[event.action];
      stats[metric] += event.count;
    }
    stats.netChange = stats.joined - stats.left;
    stats.eventCount = events.length;
    return stats;
  }

  async deleteMemberStats(groupJid) {
    if (typeof groupJid !== 'string' || !GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group JID must be a valid WhatsApp group JID.');
    }
    return this.mutate((database) => {
      const before = database.memberEvents.length;
      database.memberEvents = database.memberEvents.filter(
        (item) => item.groupJid !== groupJid,
      );
      delete database.memberConsents[groupJid];
      return before - database.memberEvents.length;
    });
  }

  async setMemberConsent(groupJid, enabled) {
    if (typeof groupJid !== 'string' || !GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group JID must be a valid WhatsApp group JID.');
    }
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Member statistics consent must be a boolean.');
    }
    return this.mutate((database) => {
      if (enabled) {
        if (
          !database.memberConsents[groupJid] &&
          Object.keys(database.memberConsents).length >= MAX_TRACKED_GROUPS
        ) {
          const error = new Error('WhatsApp member consent storage has reached its configured limit.');
          error.code = 'MEMBER_STATS_LIMIT_REACHED';
          throw error;
        }
        database.memberConsents[groupJid] = true;
      } else {
        delete database.memberConsents[groupJid];
        database.memberEvents = database.memberEvents.filter(
          (item) => item.groupJid !== groupJid,
        );
      }
      return enabled;
    });
  }

  async hasMemberConsent(groupJid) {
    if (typeof groupJid !== 'string' || !GROUP_JID_PATTERN.test(groupJid)) {
      throw new TypeError('Group JID must be a valid WhatsApp group JID.');
    }
    await this.load();
    return this.database.memberConsents[groupJid] === true;
  }

  async pruneExpired() {
    return this.mutate((database) => {
      const cutoff = this.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      const beforeMessages = database.messages.length;
      const beforeEvents = database.memberEvents.length;
      database.messages = database.messages.filter(
        (item) => Date.parse(item.collectedAt) >= cutoff,
      );
      database.memberEvents = database.memberEvents.filter(
        (item) => Date.parse(item.at) >= cutoff,
      );
      return {
        messagesDeleted: beforeMessages - database.messages.length,
        memberEventsDeleted: beforeEvents - database.memberEvents.length,
      };
    });
  }

  assertIdentityAndScope(identity, scope) {
    this.assertIdentity(identity);
    if (
      typeof scope !== 'string' ||
      !(GROUP_JID_PATTERN.test(scope) || USER_JID_PATTERN.test(scope))
    ) {
      throw new TypeError('WhatsApp archive scope must be a valid group or user JID.');
    }
  }

  assertIdentity(identity) {
    if (typeof identity !== 'string' || !USER_JID_PATTERN.test(identity)) {
      throw new TypeError('WhatsApp data identity must be a valid user JID.');
    }
  }

  hash(value) {
    return createHmac('sha256', Buffer.from(this.database.identityKey, 'hex'))
      .update(value)
      .digest('hex');
  }

  async mutate(operation) {
    await this.load();
    const result = this.writeQueue.then(async () => {
      const next = structuredClone(this.database);
      const value = operation(next);
      if (value === SKIP_MUTATION) {
        return undefined;
      }
      await this.persist(next);
      this.database = next;
      return value;
    });
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  async persist(database) {
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await writeFile(temporaryPath, `${JSON.stringify(database)}\n`, {
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
            'Failed to persist WhatsApp data and clean up its temporary file.',
          );
        }
      }
      throw error;
    }
  }
}

const createWhatsAppArchiveStore = (filePath, options) =>
  new WhatsAppArchiveStore(filePath, options);

export {
  MAX_MESSAGES,
  WhatsAppArchiveStore,
  createWhatsAppArchiveStore,
};
