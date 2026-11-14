import { sendReply } from '../../utils/formatter.js';
import logger from '../../utils/logger.js';
import {
  findBotParticipant,
  findParticipant,
  findSenderParticipant,
  getParticipantJidForOperation,
  isAdminParticipant,
  isGroupJid,
} from '../../utils/groupPermissions.js';
import {
  isValidPhoneNumber,
  normalizePhoneNumber,
} from '../../utils/senderResolver.js';

const reply = (context, text) =>
  sendReply({ message: context.message, socket: context.socket }, text);

const replyWithPayload = (context, payload) => {
  const groupJid = context.message?.key?.remoteJid;
  return context.socket.sendMessage(groupJid, payload);
};

const getGroupContext = async (
  context,
  { requireAdmin = false, requireBotAdmin = false } = {},
) => {
  const groupJid = context.message?.key?.remoteJid;
  if (!isGroupJid(groupJid)) {
    await reply(context, 'Perintah ini hanya dapat digunakan di dalam grup.');
    return null;
  }
  if (typeof context.socket?.groupMetadata !== 'function') {
    await reply(context, 'Informasi grup tidak tersedia dari koneksi WhatsApp.');
    return null;
  }

  let metadata;
  try {
    metadata = await context.socket.groupMetadata(groupJid);
  } catch (error) {
    logger.warning(`Could not load group metadata for ${groupJid}.`);
    logger.debug(error instanceof Error ? error.message : 'Unknown group metadata error.');
    await reply(context, 'Informasi grup tidak dapat diakses saat ini.');
    return null;
  }
  if (!Array.isArray(metadata?.participants)) {
    await reply(context, 'Grup tidak tersedia atau metadata grup tidak valid.');
    return null;
  }

  const senderParticipant = findSenderParticipant(
    metadata,
    context.message,
    context.senderInfo,
    context.resolveParticipant,
  );
  if (!senderParticipant) {
    await reply(context, 'Identitas pengirim tidak dapat diverifikasi sebagai anggota grup.');
    return null;
  }
  const botParticipant = findBotParticipant(
    metadata,
    context.socket,
    context.resolveParticipant,
  );
  if (!botParticipant) {
    await reply(context, 'Bot harus tergabung di grup untuk menjalankan perintah ini.');
    return null;
  }
  if (requireAdmin && !isAdminParticipant(senderParticipant)) {
    await reply(context, 'Perintah ini hanya dapat digunakan oleh admin grup.');
    return null;
  }
  if (requireBotAdmin && !isAdminParticipant(botParticipant)) {
    await reply(context, 'Bot harus menjadi admin grup untuk menjalankan operasi ini.');
    return null;
  }
  return { groupJid, metadata, senderParticipant, botParticipant };
};

const getMessageContextInfo = (message) => {
  let content = message?.message;
  const wrappers = [
    'ephemeralMessage',
    'viewOnceMessage',
    'viewOnceMessageV2',
    'viewOnceMessageV2Extension',
    'documentWithCaptionMessage',
    'editedMessage',
  ];
  for (let depth = 0; depth < 6 && content && typeof content === 'object'; depth += 1) {
    const wrapper = wrappers.find((key) => content[key]?.message);
    if (!wrapper) {
      break;
    }
    content = content[wrapper].message;
  }
  return (
    content?.extendedTextMessage?.contextInfo ||
    content?.imageMessage?.contextInfo ||
    content?.videoMessage?.contextInfo ||
    content?.documentMessage?.contextInfo ||
    {}
  );
};

const normalizeTargetJid = (value, resolveParticipant) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined;
  }
  const target = value.trim().replace(/^@/u, '');
  if (target.endsWith('@s.whatsapp.net')) {
    const phoneNumber = normalizePhoneNumber(
      target.slice(0, target.lastIndexOf('@')).split(':', 1)[0],
    );
    return phoneNumber ? `${phoneNumber}@s.whatsapp.net` : undefined;
  }
  if (target.endsWith('@lid')) {
    const resolved = resolveParticipant?.(target);
    return resolved?.resolved && isValidPhoneNumber(resolved.phoneNumber)
      ? `${resolved.phoneNumber}@s.whatsapp.net`
      : target;
  }
  const phoneNumber = normalizePhoneNumber(target);
  return phoneNumber ? `${phoneNumber}@s.whatsapp.net` : undefined;
};

const getTargetCandidates = (context) => {
  const contextInfo = getMessageContextInfo(context.message);
  const candidates = [
    ...(Array.isArray(contextInfo.mentionedJid) ? contextInfo.mentionedJid : []),
    contextInfo.participant,
    ...context.args,
  ].filter((value) => typeof value === 'string' && value.trim());
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const jid = normalizeTargetJid(candidate, context.resolveParticipant);
    if (!jid) {
      return { invalid: candidate, targets: [] };
    }
    if (!seen.has(jid)) {
      seen.add(jid);
      unique.push(jid);
    }
  }
  return { invalid: undefined, targets: unique };
};

const resolveGroupTargets = (context, groupContext, { add = false } = {}) => {
  const { invalid, targets } = getTargetCandidates(context);
  if (invalid) {
    return { error: `Identitas target tidak valid: ${invalid}` };
  }
  if (targets.length === 0) {
    return { error: `Sebutkan anggota atau nomor telepon. Contoh: ${context.prefix}${context.command.name} 6281234567890` };
  }

  const resolvedTargets = [];
  for (const target of targets) {
    const existing = findParticipant(
      groupContext.metadata.participants,
      target,
      context.resolveParticipant,
    );
    if (add && existing) {
      return { error: 'Salah satu nomor yang disebutkan sudah menjadi anggota grup.' };
    }
    if (!add && !existing) {
      return { error: 'Salah satu target bukan anggota grup atau identitasnya tidak dapat diverifikasi.' };
    }
    resolvedTargets.push(
      add ? target : getParticipantJidForOperation(existing),
    );
  }
  return { targets: resolvedTargets };
};

export {
  getGroupContext,
  reply,
  replyWithPayload,
  resolveGroupTargets,
};
