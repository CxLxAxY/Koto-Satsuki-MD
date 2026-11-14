import { formatUnavailable } from '../../utils/formatter.js';
import logger from '../../utils/logger.js';
import {
  getParticipantJidForOperation,
  isAdminParticipant,
} from '../../utils/groupPermissions.js';
import {
  getGroupContext,
  reply,
  replyWithPayload,
  resolveGroupTargets,
} from './helpers.js';

const groupinfo = async (context) => {
  const group = await getGroupContext(context);
  if (!group) {
    return;
  }
  const admins = group.metadata.participants.filter(isAdminParticipant).length;
  return reply(
    context,
    [
      `Nama grup: ${formatUnavailable(group.metadata.subject)}`,
      `Group ID: ${group.groupJid}`,
      `Jumlah anggota: ${group.metadata.participants.length}`,
      `Jumlah admin: ${admins}`,
      `Mode pesan: ${group.metadata.announce ? 'Admin saja' : 'Semua anggota'}`,
    ].join('\n'),
  );
};

const linkgroup = async (context) => {
  const group = await getGroupContext(context);
  if (!group) {
    return;
  }
  if (typeof context.socket.groupInviteCode !== 'function') {
    return reply(context, 'Fitur untuk mendapatkan link undangan tidak tersedia.');
  }
  try {
    const code = await context.socket.groupInviteCode(group.groupJid);
    if (typeof code !== 'string' || code.length === 0) {
      return reply(context, 'Link undangan grup tidak dapat diperoleh.');
    }
    return reply(context, `Link undangan grup:\nhttps://chat.whatsapp.com/${code}`);
  } catch (error) {
    logger.error(`Failed to obtain invite link for group ${group.groupJid}.`, error);
    return reply(context, 'Link undangan grup tidak dapat diperoleh saat ini.');
  }
};

const changeParticipants = async (context, action, description) => {
  const group = await getGroupContext(context, {
    requireAdmin: true,
    requireBotAdmin: true,
  });
  if (!group) {
    return;
  }
  if (typeof context.socket.groupParticipantsUpdate !== 'function') {
    return reply(context, 'Operasi anggota grup tidak tersedia dari koneksi WhatsApp.');
  }
  const { targets, error } = resolveGroupTargets(context, group, {
    add: action === 'add',
  });
  if (error) {
    return reply(context, error);
  }
  try {
    const result = await context.socket.groupParticipantsUpdate(
      group.groupJid,
      targets,
      action,
    );
    if (!Array.isArray(result) || result.length === 0) {
      return reply(context, `WhatsApp tidak mengonfirmasi operasi ${description}.`);
    }
    const succeeded = result.filter(
      (item) => Number(item?.status) >= 200 && Number(item?.status) < 300,
    ).length;
    const failed = Math.max(targets.length - succeeded, 0);
    if (succeeded === targets.length) {
      return reply(context, `Berhasil ${description} ${succeeded} anggota.`);
    }
    if (succeeded > 0) {
      return reply(
        context,
        `Operasi ${description} sebagian berhasil: ${succeeded} berhasil, ${failed} gagal.`,
      );
    }
    return reply(context, `Gagal ${description}. WhatsApp menolak operasi untuk target.`);
  } catch (error) {
    logger.error(`Failed to ${description} group participants in ${group.groupJid}.`, error);
    return reply(context, `Gagal ${description}. Periksa keanggotaan dan izin bot.`);
  }
};

const kick = (context) => changeParticipants(context, 'remove', 'mengeluarkan');
const add = (context) => changeParticipants(context, 'add', 'menambahkan');
const promote = (context) => changeParticipants(context, 'promote', 'mengangkat');
const demote = (context) => changeParticipants(context, 'demote', 'menurunkan');

const mentionAll = async (context, hidden) => {
  const group = await getGroupContext(context, { requireAdmin: true });
  if (!group) {
    return;
  }
  const mentions = group.metadata.participants
    .map(getParticipantJidForOperation)
    .filter((jid) => typeof jid === 'string' && /@(?:s\.whatsapp\.net|lid)$/u.test(jid));
  if (mentions.length === 0) {
    return reply(context, 'Daftar anggota grup tidak tersedia untuk disebutkan.');
  }
  const text = hidden
    ? 'Seluruh anggota grup disebutkan.'
    : `Tag seluruh anggota:\n${mentions
        .map((jid) => `@${jid.slice(0, jid.lastIndexOf('@')).split(':', 1)[0]}`)
        .join(' ')}`;
  return replyWithPayload(context, {
    text,
    contextInfo: { mentionedJid: mentions },
  });
};

const tagall = (context) => mentionAll(context, false);
const hidetag = (context) => mentionAll(context, true);

const updateGroupMode = async (context, setting, label) => {
  const group = await getGroupContext(context, {
    requireAdmin: true,
    requireBotAdmin: true,
  });
  if (!group) {
    return;
  }
  if (typeof context.socket.groupSettingUpdate !== 'function') {
    return reply(context, 'Pengaturan pesan grup tidak tersedia dari koneksi WhatsApp.');
  }
  try {
    await context.socket.groupSettingUpdate(group.groupJid, setting);
    const updated = await context.socket.groupMetadata(group.groupJid);
    const expectedAnnouncement = setting === 'announcement';
    if (updated?.announce !== expectedAnnouncement) {
      return reply(context, `Perubahan mode ${label} belum dapat dikonfirmasi.`);
    }
    return reply(context, `Grup sekarang ${label}.`);
  } catch (error) {
    logger.error(`Failed to update group mode for ${group.groupJid}.`, error);
    return reply(context, `Gagal mengubah mode grup. Periksa izin admin bot.`);
  }
};

const groupopen = (context) => updateGroupMode(context, 'not_announcement', 'terbuka');
const groupclose = (context) => updateGroupMode(context, 'announcement', 'tertutup');

const updateGroupText = async (context, kind) => {
  const group = await getGroupContext(context, {
    requireAdmin: true,
    requireBotAdmin: true,
  });
  if (!group) {
    return;
  }
  const value = context.args.join(' ').trim();
  if (!value) {
    return reply(
      context,
      `Masukkan ${kind === 'subject' ? 'nama' : 'deskripsi'} grup. Contoh: ${context.prefix}${kind === 'subject' ? 'setname' : 'setdesc'} teks baru`,
    );
  }
  const method =
    kind === 'subject' ? context.socket.groupUpdateSubject : context.socket.groupUpdateDescription;
  if (typeof method !== 'function') {
    return reply(context, 'Pengaturan informasi grup tidak tersedia dari koneksi WhatsApp.');
  }
  try {
    await method.call(context.socket, group.groupJid, value);
    const updated = await context.socket.groupMetadata(group.groupJid);
    const actual = kind === 'subject' ? updated?.subject : updated?.desc;
    if (typeof actual === 'string' && actual !== value) {
      return reply(context, `Perubahan ${kind === 'subject' ? 'nama' : 'deskripsi'} grup belum dapat dikonfirmasi.`);
    }
    return reply(context, `Berhasil mengubah ${kind === 'subject' ? 'nama' : 'deskripsi'} grup.`);
  } catch (error) {
    logger.error(`Failed to update group ${kind} for ${group.groupJid}.`, error);
    return reply(context, `Gagal mengubah ${kind === 'subject' ? 'nama' : 'deskripsi'} grup.`);
  }
};

const setname = (context) => updateGroupText(context, 'subject');
const setdesc = (context) => updateGroupText(context, 'description');

const revoke = async (context) => {
  const group = await getGroupContext(context, {
    requireAdmin: true,
    requireBotAdmin: true,
  });
  if (!group) {
    return;
  }
  if (typeof context.socket.groupRevokeInvite !== 'function') {
    return reply(context, 'Fitur untuk memperbarui link undangan tidak tersedia.');
  }
  try {
    const code = await context.socket.groupRevokeInvite(group.groupJid);
    if (typeof code !== 'string' || code.length === 0) {
      return reply(context, 'WhatsApp tidak mengonfirmasi link undangan baru.');
    }
    return reply(
      context,
      `Link undangan berhasil diperbarui:\nhttps://chat.whatsapp.com/${code}`,
    );
  } catch (error) {
    logger.error(`Failed to revoke invite link for group ${group.groupJid}.`, error);
    return reply(context, 'Gagal memperbarui link undangan grup.');
  }
};

export {
  add,
  demote,
  groupclose,
  groupinfo,
  groupopen,
  hidetag,
  kick,
  linkgroup,
  promote,
  revoke,
  setdesc,
  setname,
  tagall,
};
