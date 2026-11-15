const PHONE_NUMBER_PATTERN = /^\d{8,15}$/u;
const LID_PATTERN = /@lid$/u;

const isValidPhoneNumber = (phoneNumber) =>
  typeof phoneNumber === 'string' && PHONE_NUMBER_PATTERN.test(phoneNumber);

const normalizePhoneNumber = (phoneNumber) => {
  if (typeof phoneNumber !== 'string') {
    return '';
  }

  const normalized = phoneNumber.trim().replace(/[\s()+.-]/gu, '');
  return isValidPhoneNumber(normalized) ? normalized : '';
};

const getPhoneNumberFromJid = (jid) => {
  if (typeof jid !== 'string') {
    return undefined;
  }

  const separator = jid.lastIndexOf('@');
  if (separator < 1 || jid.slice(separator + 1) !== 's.whatsapp.net') {
    return undefined;
  }

  const phoneNumber = jid.slice(0, separator).split(':', 1)[0];
  return isValidPhoneNumber(phoneNumber) ? phoneNumber : undefined;
};

const createSenderResolver = () => {
  const lidToPhoneNumber = new Map();
  const maximumMappings = 10000;

  const rememberLidMapping = ({ lid, pn } = {}) => {
    if (typeof lid !== 'string' || !LID_PATTERN.test(lid)) {
      return false;
    }

    const phoneNumber = getPhoneNumberFromJid(pn);
    if (!phoneNumber) {
      return false;
    }

    if (!lidToPhoneNumber.has(lid) && lidToPhoneNumber.size >= maximumMappings) {
      const oldest = lidToPhoneNumber.keys().next().value;
      if (oldest) {
        lidToPhoneNumber.delete(oldest);
      }
    }
    lidToPhoneNumber.set(lid, phoneNumber);
    return true;
  };

  const resolve = (messageOrJid) => {
    const key = typeof messageOrJid === 'string' ? undefined : messageOrJid?.key;
    const primaryJid =
      typeof messageOrJid === 'string'
        ? messageOrJid
        : key?.participant || key?.remoteJid;
    const phoneCandidates = [
      primaryJid,
      key?.participantPn,
      key?.senderPn,
      key?.participantAlt,
      key?.remoteJidAlt,
    ];

    for (const candidate of phoneCandidates) {
      const phoneNumber = getPhoneNumberFromJid(candidate);
      if (phoneNumber) {
        return { phoneNumber, resolved: true };
      }
    }

    const mappedPhoneNumber =
      (typeof primaryJid === 'string' ? lidToPhoneNumber.get(primaryJid) : undefined) ||
      (typeof key?.participantLid === 'string'
        ? lidToPhoneNumber.get(key.participantLid)
        : undefined) ||
      (typeof key?.senderLid === 'string' ? lidToPhoneNumber.get(key.senderLid) : undefined);
    return mappedPhoneNumber
      ? { phoneNumber: mappedPhoneNumber, resolved: true }
      : { phoneNumber: 'UNRESOLVED', resolved: false };
  };

  const getIdentity = (message) => {
    const key = message?.key || {};
    const senderJid =
      key.participant ||
      key.participantPn ||
      key.participantLid ||
      key.senderPn ||
      key.senderLid ||
      key.remoteJid ||
      'UNRESOLVED';
    const senderLid =
      key.participantLid ||
      key.senderLid ||
      [key.participant, key.remoteJid].find(
        (jid) => typeof jid === 'string' && LID_PATTERN.test(jid),
      ) ||
      'UNAVAILABLE';

    return {
      senderJid,
      senderLid,
      ...resolve(message),
    };
  };

  return { getIdentity, rememberLidMapping, resolve };
};

const defaultResolver = createSenderResolver();
const resolveSender = (messageOrJid) => defaultResolver.resolve(messageOrJid);
const resolveSenderJid = (jid) => getPhoneNumberFromJid(jid) || 'UNRESOLVED';

export {
  createSenderResolver,
  isValidPhoneNumber,
  normalizePhoneNumber,
  resolveSender,
  resolveSenderJid,
};
export default {
  createSenderResolver,
  isValidPhoneNumber,
  normalizePhoneNumber,
  resolveSender,
  resolveSenderJid,
};

