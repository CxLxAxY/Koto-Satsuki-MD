import { isValidPhoneNumber } from './senderResolver.js';

const isGroupJid = (jid) => typeof jid === 'string' && jid.endsWith('@g.us');

const getPhoneNumber = (jid) => {
  if (typeof jid !== 'string' || !jid.endsWith('@s.whatsapp.net')) {
    return undefined;
  }
  const phoneNumber = jid.slice(0, jid.lastIndexOf('@')).split(':', 1)[0];
  return isValidPhoneNumber(phoneNumber) ? phoneNumber : undefined;
};

const getResolvedPhone = (jid, resolveParticipant) => {
  if (typeof resolveParticipant !== 'function') {
    return undefined;
  }
  const resolved = resolveParticipant(jid);
  return resolved?.resolved && isValidPhoneNumber(resolved.phoneNumber)
    ? resolved.phoneNumber
    : undefined;
};

const collectIdentityTokens = (identity, resolveParticipant) => {
  const tokens = new Set();
  const addJid = (jid) => {
    if (typeof jid !== 'string' || !jid.includes('@')) {
      return;
    }
    tokens.add(`jid:${jid}`);
    const phoneNumber =
      getPhoneNumber(jid) || getResolvedPhone(jid, resolveParticipant);
    if (phoneNumber) {
      tokens.add(`pn:${phoneNumber}`);
    }
  };
  const addPhone = (phone) => {
    const value = typeof phone === 'string' ? phone : '';
    const normalized = value.includes('@') ? getPhoneNumber(value) : value.replace(/\D/gu, '');
    if (normalized && isValidPhoneNumber(normalized)) {
      tokens.add(`pn:${normalized}`);
    }
  };

  if (typeof identity === 'string') {
    addJid(identity);
    return tokens;
  }
  if (!identity || typeof identity !== 'object') {
    return tokens;
  }

  for (const jid of [
    identity.id,
    identity.jid,
    identity.participant,
    identity.participantPn,
    identity.participantLid,
    identity.phoneNumberJid,
    identity.lid,
    identity.pn,
  ]) {
    addJid(jid);
  }
  for (const phone of [identity.phoneNumber, identity.phone]) {
    addPhone(phone);
  }
  return tokens;
};

const identitiesMatch = (left, right, resolveParticipant) => {
  const leftTokens = collectIdentityTokens(left, resolveParticipant);
  const rightTokens = collectIdentityTokens(right, resolveParticipant);
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      return true;
    }
  }
  return false;
};

const getSenderIdentities = (message, senderInfo) => {
  const key = message?.key || {};
  return [
    key.participant,
    key.participantPn,
    key.senderPn,
    key.participantAlt,
    key.participantLid,
    key.senderLid,
    senderInfo?.senderJid,
    senderInfo?.senderLid,
    senderInfo?.phoneNumber
      ? `${senderInfo.phoneNumber}@s.whatsapp.net`
      : undefined,
  ].filter(Boolean);
};

const getBotIdentities = (socket) => {
  const user = socket?.user || {};
  return [user.id, user.lid, user.phoneNumber].filter(Boolean);
};

const findParticipant = (participants, identity, resolveParticipant) => {
  if (!Array.isArray(participants)) {
    return undefined;
  }
  const identities = Array.isArray(identity) ? identity : [identity];
  return participants.find((participant) =>
    identities.some((candidate) =>
      identitiesMatch(participant, candidate, resolveParticipant),
    ),
  );
};

const findSenderParticipant = (metadata, message, senderInfo, resolveParticipant) =>
  findParticipant(
    metadata?.participants,
    getSenderIdentities(message, senderInfo),
    resolveParticipant,
  );

const findBotParticipant = (metadata, socket, resolveParticipant) =>
  findParticipant(
    metadata?.participants,
    getBotIdentities(socket),
    resolveParticipant,
  );

const isAdminParticipant = (participant) =>
  participant?.admin === 'admin' ||
  participant?.admin === 'superadmin' ||
  participant?.isAdmin === true ||
  participant?.isSuperAdmin === true;

const getParticipantJid = (participant) =>
  typeof participant === 'string'
    ? participant
    : participant?.id || participant?.jid || participant?.participant;

const getParticipantJidForOperation = (participant) =>
  getParticipantJid(participant) ||
  participant?.phoneNumberJid ||
  participant?.pn ||
  participant?.lid;

export {
  collectIdentityTokens,
  findBotParticipant,
  findParticipant,
  findSenderParticipant,
  getBotIdentities,
  getParticipantJid,
  getParticipantJidForOperation,
  getSenderIdentities,
  identitiesMatch,
  isAdminParticipant,
  isGroupJid,
};
