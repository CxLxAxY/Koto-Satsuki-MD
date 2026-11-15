import config from '../config/config.js';
import {
  findBotParticipant,
  isAdminParticipant,
  isGroupJid,
} from '../utils/groupPermissions.js';
import logger from '../utils/logger.js';
import { createGroupConfigStore } from './groupConfigStore.js';

const TIME_ZONE = 'Asia/Jakarta';
const MINUTE_MS = 60 * 1000;

const createZonedFormatter = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

const getZonedParts = (date, formatter) => {
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
};

const getDateKey = ({ year, month, day }) =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const shiftDateKey = (dateKey, days) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return getDateKey({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
};

const getLocalDateTimeEpoch = (dateKey, time, formatter) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let epoch = localAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = getZonedParts(new Date(epoch), formatter);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
    );
    const nextEpoch = localAsUtc - (zonedAsUtc - epoch);
    if (nextEpoch === epoch) {
      return epoch;
    }
    epoch = nextEpoch;
  }
  return epoch;
};

const getLatestDueSchedule = (groupConfig, now, formatter) => {
  const zonedNow = getZonedParts(now, formatter);
  const today = getDateKey(zonedNow);
  const minuteOfDay = zonedNow.hour * 60 + zonedNow.minute;
  const nowMs = now.getTime();
  const due = [];

  for (const [name, schedule] of [
    ['autoClose', groupConfig.autoClose],
    ['autoOpen', groupConfig.autoOpen],
  ]) {
    if (!schedule.enabled || !schedule.time || !schedule.enabledAt) {
      continue;
    }
    const [hour, minute] = schedule.time.split(':').map(Number);
    const scheduleMinute = hour * 60 + minute;
    const date = scheduleMinute <= minuteOfDay ? today : shiftDateKey(today, -1);
    const occurredAt = getLocalDateTimeEpoch(date, schedule.time, formatter);
    if (
      occurredAt <= nowMs &&
      Date.parse(schedule.enabledAt) <= occurredAt
    ) {
      due.push({ name, date, occurredAt });
    }
  }

  return due.sort((left, right) => right.occurredAt - left.occurredAt)[0];
};

class GroupScheduler {
  constructor({
    store,
    appLogger = logger,
    timeZone = TIME_ZONE,
    now = () => new Date(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  }) {
    if (!store || typeof store.getAll !== 'function' || typeof store.update !== 'function') {
      throw new TypeError('Group scheduler requires a compatible configuration store.');
    }
    this.store = store;
    this.logger = appLogger;
    this.timeZone = timeZone;
    this.formatter = createZonedFormatter(timeZone);
    this.now = now;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.running = false;
    this.timer = undefined;
    this.socket = undefined;
    this.resolveParticipant = undefined;
    this.inFlightGroups = new Map();
  }

  async start() {
    if (this.running) {
      return;
    }
    await this.store.load?.();
    this.running = true;
    try {
      await this.reconcileAll();
      this.scheduleNextTick();
    } catch (error) {
      this.running = false;
      throw error;
    }
  }

  async stop() {
    this.running = false;
    if (this.timer) {
      this.clearTimeoutFn(this.timer);
      this.timer = undefined;
    }
    await Promise.allSettled([...this.inFlightGroups.values()]);
  }

  setSocket(socket, resolveParticipant) {
    this.socket = socket;
    this.resolveParticipant = resolveParticipant;
    if (this.running && socket) {
      void this.reconcileAll().catch((error) => {
        this.logger.error('Failed to reconcile group schedules after reconnect.', error);
      });
    }
  }

  clearSocket(socket) {
    if (!socket || this.socket === socket) {
      this.socket = undefined;
      this.resolveParticipant = undefined;
    }
  }

  async refreshGroup(groupJid) {
    if (!isGroupJid(groupJid)) {
      throw new TypeError('Cannot refresh a schedule for an invalid group JID.');
    }
    if (!this.running || !this.socket) {
      return undefined;
    }
    return this.reconcileGroup(groupJid, this.now());
  }

  async reconcileAll(now = this.now()) {
    if (!this.socket) {
      return;
    }
    const groups = await this.store.getAll();
    for (const { groupJid, config: groupConfig } of groups) {
      try {
        await this.reconcileConfig(groupJid, groupConfig, now);
      } catch (error) {
        this.logger.error(
          `Failed to reconcile group schedule: group=${groupJid}.`,
          error,
        );
      }
    }
  }

  async reconcileGroup(groupJid, now = this.now()) {
    if (!this.socket) {
      return undefined;
    }
    const groupConfig = await this.store.get(groupJid);
    return this.reconcileConfig(groupJid, groupConfig, now);
  }

  async reconcileConfig(groupJid, groupConfig, now) {
    const schedule = getLatestDueSchedule(groupConfig, now, this.formatter);
    if (!schedule) {
      return undefined;
    }
    const previousExecution = groupConfig[schedule.name].lastExecution;
    if (previousExecution?.date === schedule.date) {
      return { status: previousExecution.status };
    }
    return this.executeSchedule(groupJid, schedule.name, schedule.date);
  }

  async runSchedulerCycle(now = this.now()) {
    return this.reconcileAll(now);
  }

  async executeSchedule(groupJid, name, date) {
    const existing = this.inFlightGroups.get(groupJid);
    if (existing) {
      return existing;
    }

    const operation = Promise.resolve().then(async () => {
      const targetSetting = name === 'autoClose' ? 'announcement' : 'not_announcement';
      const now = this.now();
      let status = 'success';
      let failure;

      try {
        const result = await this.applyGroupSetting(groupJid, targetSetting);
        status = result.status;
      } catch (error) {
        status = 'failed';
        failure = error;
      }

      const execution = {
        date,
        at: now.toISOString(),
        status,
        ...(failure ? { error: failure.message.slice(0, 300) } : {}),
      };
      await this.store.update(groupJid, (groupConfig) => ({
        ...groupConfig,
        [name]: {
          ...groupConfig[name],
          lastExecution: execution,
        },
      }));

      if (failure) {
        this.logger.error(
          `Group schedule failed: group=${groupJid} action=${name} status=failed.`,
          failure,
        );
        return { status, error: failure };
      }
      this.logger.system(
        `Group schedule completed: group=${groupJid} action=${name} status=${status}.`,
      );
      return { status };
    });

    this.inFlightGroups.set(groupJid, operation);
    try {
      return await operation;
    } finally {
      if (this.inFlightGroups.get(groupJid) === operation) {
        this.inFlightGroups.delete(groupJid);
      }
    }
  }

  async applyGroupSetting(groupJid, setting) {
    const socket = this.socket;
    if (!socket || typeof socket.groupMetadata !== 'function') {
      throw new Error('WhatsApp connection is unavailable for a scheduled group update.');
    }
    const metadata = await socket.groupMetadata(groupJid);
    if (!Array.isArray(metadata?.participants)) {
      throw new Error('Group metadata is unavailable for a scheduled group update.');
    }
    const botParticipant = findBotParticipant(
      metadata,
      socket,
      this.resolveParticipant,
    );
    if (!isAdminParticipant(botParticipant)) {
      throw new Error('Bot is not a group admin; scheduled setting was not applied.');
    }

    const targetAnnouncement = setting === 'announcement';
    if (metadata.announce === targetAnnouncement) {
      return { status: 'already_in_target_state' };
    }
    if (typeof socket.groupSettingUpdate !== 'function') {
      throw new Error('Baileys groupSettingUpdate is unavailable.');
    }
    await socket.groupSettingUpdate(groupJid, setting);
    const updatedMetadata = await socket.groupMetadata(groupJid);
    if (updatedMetadata?.announce !== targetAnnouncement) {
      throw new Error('Group setting update was not confirmed by group metadata.');
    }
    return { status: 'success' };
  }

  scheduleNextTick() {
    if (!this.running || this.timer) {
      return;
    }
    const now = this.now().getTime();
    const delay = MINUTE_MS - (now % MINUTE_MS) + 10;
    this.timer = this.setTimeoutFn(() => {
      this.timer = undefined;
      void this.runSchedulerCycle().catch((error) => {
        this.logger.error('Group scheduler tick failed.', error);
      }).finally(() => {
        this.scheduleNextTick();
      });
    }, delay);
    this.timer?.unref?.();
  }
}

const createGroupScheduler = (options = {}) => new GroupScheduler(options);
const groupConfigStore = createGroupConfigStore(config.paths.groupConfig);
const groupScheduler = createGroupScheduler({ store: groupConfigStore });

export {
  GroupScheduler,
  TIME_ZONE,
  createGroupScheduler,
  getDateKey,
  getLatestDueSchedule,
  getLocalDateTimeEpoch,
  getZonedParts,
  groupConfigStore,
  groupScheduler,
  shiftDateKey,
};
