import { TIME_PATTERN } from '../../core/groupConfigStore.js';
import { groupConfigStore, groupScheduler } from '../../core/groupScheduler.js';
import logger from '../../utils/logger.js';
import { getGroupContext, reply } from './helpers.js';

const createGroupSettingsHandlers = ({
  store = groupConfigStore,
  scheduler = groupScheduler,
  now = () => new Date(),
} = {}) => {
  const setTemplate = (key, label) => async (context) => {
    const group = await getGroupContext(context, { requireAdmin: true });
    if (!group) {
      return;
    }
    const template = context.args.join(' ').trim();
    if (!template) {
      return reply(
        context,
        `Masukkan template ${label}. Placeholder: {user}, {group}, {memberCount}.`,
      );
    }
    if (template.length > 500) {
      return reply(context, `Template ${label} maksimal 500 karakter.`);
    }
    try {
      await store.update(group.groupJid, (config) => ({
        ...config,
        [key]: {
          ...config[key],
          template,
        },
      }));
      return reply(context, `Template ${label} berhasil disimpan.`);
    } catch (error) {
      logger.error(`Failed to save ${label} template for ${group.groupJid}.`, error);
      return reply(context, `Template ${label} gagal disimpan.`);
    }
  };

  const toggle = (key, label) => async (context) => {
    const group = await getGroupContext(context, { requireAdmin: true });
    if (!group) {
      return;
    }
    const action = context.args[0]?.toLowerCase();
    if (context.args.length !== 1 || !['on', 'off'].includes(action)) {
      return reply(context, `Gunakan ${context.prefix}${key} on atau ${context.prefix}${key} off.`);
    }
    try {
      await store.update(group.groupJid, (config) => ({
        ...config,
        [key]: {
          ...config[key],
          enabled: action === 'on',
        },
      }));
      return reply(
        context,
        `${label} ${action === 'on' ? 'diaktifkan' : 'dinonaktifkan'}.`,
      );
    } catch (error) {
      logger.error(`Failed to update ${label} for ${group.groupJid}.`, error);
      return reply(context, `Pengaturan ${label} gagal disimpan.`);
    }
  };

  const setSchedule = (name, label, enableOnSave) => async (context) => {
    const group = await getGroupContext(context, { requireAdmin: true });
    if (!group) {
      return;
    }
    const time = context.args[0];
    if (context.args.length !== 1 || !TIME_PATTERN.test(time || '')) {
      return reply(context, `Format waktu wajib HH:mm (24 jam). Contoh: ${context.prefix}${context.command.name} 22:00`);
    }

    try {
      const current = await store.get(group.groupJid);
      const otherName = name === 'autoClose' ? 'autoOpen' : 'autoClose';
      if (current[otherName].time === time) {
        logger.warning(
          `Rejected conflicting group schedules: group=${group.groupJid} time=${time}.`,
        );
        return reply(
          context,
          `Waktu ${time} WIB bertentangan dengan jadwal ${otherName === 'autoClose' ? 'auto-close' : 'auto-open'} grup.`,
        );
      }
      const enabled = enableOnSave || current[name].enabled;
      const enabledAt = enabled ? now().toISOString() : null;
      await store.update(group.groupJid, (config) => ({
        ...config,
        [name]: {
          ...config[name],
          enabled,
          time,
          enabledAt,
          lastExecution: null,
        },
      }));
      try {
        await scheduler.refreshGroup(group.groupJid);
      } catch (error) {
        logger.error(
          `Saved ${label} schedule but immediate reconciliation failed for ${group.groupJid}.`,
          error,
        );
      }
      return reply(
        context,
        `Jadwal ${label} disimpan pukul ${time} WIB setiap hari${enabled ? ' dan diaktifkan' : ''}.`,
      );
    } catch (error) {
      logger.error(`Failed to save ${label} schedule for ${group.groupJid}.`, error);
      return reply(context, `Jadwal ${label} gagal disimpan.`);
    }
  };

  const toggleSchedule = (name, label) => async (context) => {
    const group = await getGroupContext(context, { requireAdmin: true });
    if (!group) {
      return;
    }
    const action = context.args[0]?.toLowerCase();
    if (context.args.length !== 1 || !['on', 'off'].includes(action)) {
      return reply(
        context,
        `Gunakan ${context.prefix}${context.command.name} on atau ${context.prefix}${context.command.name} off.`,
      );
    }
    try {
      const current = await store.get(group.groupJid);
      if (action === 'on' && !current[name].time) {
        return reply(
          context,
          `Atur waktu terlebih dahulu dengan ${context.prefix}${name === 'autoClose' ? 'setautoclosegroup' : 'setautoopengroup'} HH:mm.`,
        );
      }
      const otherName = name === 'autoClose' ? 'autoOpen' : 'autoClose';
      if (action === 'on' && current[otherName].time === current[name].time) {
        return reply(context, `Jadwal ${label} bertentangan dengan jadwal lainnya.`);
      }
      const enabled = action === 'on';
      await store.update(group.groupJid, (config) => ({
        ...config,
        [name]: {
          ...config[name],
          enabled,
          enabledAt: enabled ? now().toISOString() : null,
          lastExecution: enabled ? null : config[name].lastExecution,
        },
      }));
      if (enabled) {
        try {
          await scheduler.refreshGroup(group.groupJid);
        } catch (error) {
          logger.error(
            `Enabled ${label} schedule but immediate reconciliation failed for ${group.groupJid}.`,
            error,
          );
        }
      }
      return reply(
        context,
        `Jadwal ${label} ${enabled ? `diaktifkan pukul ${current[name].time} WIB` : 'dinonaktifkan'}.`,
      );
    } catch (error) {
      logger.error(`Failed to toggle ${label} schedule for ${group.groupJid}.`, error);
      return reply(context, `Pengaturan jadwal ${label} gagal disimpan.`);
    }
  };

  return {
    autoclosegroup: toggleSchedule('autoClose', 'auto-close'),
    autoopengroup: toggleSchedule('autoOpen', 'auto-open'),
    goodbye: toggle('goodbye', 'goodbye'),
    setautoclosegroup: setSchedule('autoClose', 'auto-close', false),
    setautoopengroup: setSchedule('autoOpen', 'auto-open', true),
    setgoodbye: setTemplate('goodbye', 'goodbye'),
    setwelcome: setTemplate('welcome', 'welcome'),
    welcome: toggle('welcome', 'welcome'),
  };
};

const handlers = createGroupSettingsHandlers();
const {
  autoclosegroup,
  autoopengroup,
  goodbye,
  setautoclosegroup,
  setautoopengroup,
  setgoodbye,
  setwelcome,
  welcome,
} = handlers;

export {
  autoclosegroup,
  autoopengroup,
  createGroupSettingsHandlers,
  goodbye,
  setautoclosegroup,
  setautoopengroup,
  setgoodbye,
  setwelcome,
  welcome,
};
