import { DEFAULT_GOODBYE_TEMPLATE } from './groupConfigStore.js';
import { groupConfigStore } from './groupScheduler.js';
import { createProfilePhotoResolver } from './profilePhotoResolver.js';
import { sendAutomatedMessage } from './messageSender.js';
import {
  collectIdentityTokens,
  getParticipantJid,
  isGroupJid,
} from '../utils/groupPermissions.js';
import logger from '../utils/logger.js';

const EVENT_DEDUPLICATION_TTL_MS = 30_000;
const MAX_DEDUPLICATED_EVENTS = 5000;

const normalizeResolver = (resolver) => {
  if (typeof resolver === 'function') {
    return resolver;
  }
  if (typeof resolver?.resolve === 'function') {
    return resolver.resolve.bind(resolver);
  }
  return undefined;
};

const normalizeParticipantJid = (participant) => {
  const jid = getParticipantJid(participant);
  if (typeof jid === 'string' && /@(?:s\.whatsapp\.net|lid)$/u.test(jid)) {
    return jid;
  }
  if (typeof participant?.phoneNumber === 'string') {
    if (participant.phoneNumber.includes('@')) {
      return participant.phoneNumber;
    }
    if (/^\d{8,15}$/u.test(participant.phoneNumber)) {
      return `${participant.phoneNumber}@s.whatsapp.net`;
    }
  }
  return undefined;
};

const resolveMentionJid = (participantJid, resolveParticipant) => {
  const resolved = resolveParticipant?.(participantJid);
  return resolved?.resolved && /^\d{8,15}$/u.test(resolved.phoneNumber)
    ? `${resolved.phoneNumber}@s.whatsapp.net`
    : participantJid;
};

const getRemovalReason = (update, participant, resolveParticipant) => {
  const author = {
    id: update.author,
    phoneNumberJid: update.authorPn,
    phoneNumber: update.authorPn,
  };
  if (!update.author && !update.authorPn) {
    return 'unknown';
  }
  const authorTokens = collectIdentityTokens(author, resolveParticipant);
  const participantTokens = collectIdentityTokens(participant, resolveParticipant);
  if ([...authorTokens].some((token) => participantTokens.has(token))) {
    return 'left';
  }

  const authorPhones = [...authorTokens].filter((token) => token.startsWith('pn:'));
  const participantPhones = [...participantTokens].filter((token) => token.startsWith('pn:'));
  if (authorPhones.length > 0 && participantPhones.length > 0) {
    return 'removed';
  }
  const authorJids = [...authorTokens].filter((token) => token.startsWith('jid:'));
  const participantJids = [...participantTokens].filter((token) => token.startsWith('jid:'));
  const sharedAddressingMode = authorJids.some((authorJid) =>
    participantJids.some((participantJid) => {
      const authorDomain = authorJid.slice(authorJid.lastIndexOf('@') + 1);
      const participantDomain = participantJid.slice(
        participantJid.lastIndexOf('@') + 1,
      );
      return authorDomain === participantDomain;
    }),
  );
  return sharedAddressingMode ? 'removed' : 'unknown';
};

const renderTemplate = (template, { user, group, memberCount }) =>
  template
    .replaceAll('{user}', user)
    .replaceAll('{group}', group)
    .replaceAll('{memberCount}', String(memberCount));

const getIdentityLabel = (jid) => `@${jid.slice(0, jid.lastIndexOf('@')).split(':', 1)[0]}`;

class GroupEventHandler {
  constructor({
    store = groupConfigStore,
    profilePhotoResolver = createProfilePhotoResolver(),
    appLogger = logger,
    sendMessage = sendAutomatedMessage,
    now = Date.now,
  } = {}) {
    this.store = store;
    this.profilePhotoResolver = profilePhotoResolver;
    this.logger = appLogger;
    this.sendMessage = sendMessage;
    this.now = now;
    this.seenEvents = new Map();
  }

  async handle(update, socket, resolver) {
    const resolveParticipant = normalizeResolver(resolver);
    if (
      !isGroupJid(update?.id) ||
      !['add', 'remove'].includes(update.action) ||
      !Array.isArray(update.participants) ||
      !socket
    ) {
      return;
    }
    const settings = await this.store.get(update.id);
    const eventEnabled =
      update.action === 'add' ? settings.welcome.enabled : settings.goodbye.enabled;
    if (!eventEnabled) {
      return;
    }

    for (const participant of update.participants) {
      const participantJid = normalizeParticipantJid(participant);
      if (!participantJid) {
        this.logger.warning('Ignoring group participant event with an invalid participant JID.');
        continue;
      }
      if (this.isDuplicate(update.id, update.action, participantJid, resolveParticipant)) {
        continue;
      }
      try {
        await this.sendParticipantNotice(
          update,
          participant,
          participantJid,
          socket,
          settings,
          resolveParticipant,
        );
      } catch (error) {
        this.logger.error(
          `Failed to process ${update.action} notification for group ${update.id}.`,
          error,
        );
      }
    }
  }

  isDuplicate(groupJid, action, participantJid, resolveParticipant) {
    const now = this.now();
    for (const [key, expiresAt] of this.seenEvents) {
      if (expiresAt <= now) {
        this.seenEvents.delete(key);
      }
    }
    const resolved = resolveParticipant?.(participantJid);
    const dedupeJid =
      resolved?.resolved && /^\d{8,15}$/u.test(resolved.phoneNumber)
        ? `${resolved.phoneNumber}@s.whatsapp.net`
        : participantJid;
    const key = `${groupJid}\u0000${action}\u0000${dedupeJid}`;
    if (this.seenEvents.has(key)) {
      return true;
    }
    if (this.seenEvents.size >= MAX_DEDUPLICATED_EVENTS) {
      const oldest = this.seenEvents.keys().next().value;
      if (oldest) {
        this.seenEvents.delete(oldest);
      }
    }
    this.seenEvents.set(key, now + EVENT_DEDUPLICATION_TTL_MS);
    return false;
  }

  async sendParticipantNotice(
    update,
    participant,
    participantJid,
    socket,
    settings,
    resolveParticipant,
  ) {
    let metadata;
    try {
      metadata = await socket.groupMetadata(update.id);
    } catch (error) {
      this.logger.warning('Group metadata unavailable; using fallback notification labels.');
      this.logger.debug(error instanceof Error ? error.message : 'Unknown group metadata error.');
    }

    const groupName =
      typeof metadata?.subject === 'string' && metadata.subject.trim()
        ? metadata.subject.trim()
        : update.id;
    const memberCount = Array.isArray(metadata?.participants)
      ? metadata.participants.length
      : 'tidak tersedia';
    const mentionJid = resolveMentionJid(participantJid, resolveParticipant);
    const user = getIdentityLabel(mentionJid);
    const isWelcome = update.action === 'add';
    const template = isWelcome ? settings.welcome.template : settings.goodbye.template;
    const removalReason = isWelcome
      ? undefined
      : getRemovalReason(update, participant, resolveParticipant);
    let caption = renderTemplate(template, {
      user,
      group: groupName,
      memberCount,
    });
    if (!isWelcome && removalReason === 'removed') {
      caption =
        template === DEFAULT_GOODBYE_TEMPLATE
          ? `${user} telah dikeluarkan dari grup ${groupName}.`
          : `${caption}\nStatus: anggota dikeluarkan oleh admin.`;
    }

    const contextInfo = { mentionedJid: [mentionJid] };
    const image = await this.profilePhotoResolver.resolve(
      socket,
      update.id,
      participantJid,
      {
        refresh: !isWelcome,
        resolveParticipant,
      },
    );
    if (image) {
      await this.sendMessage(socket, update.id, {
        image: image.buffer,
        mimetype: image.mimeType,
        caption,
        contextInfo,
      });
      return;
    }
    await this.sendMessage(socket, update.id, {
      text: caption,
      contextInfo,
    });
  }
}

const createGroupEventHandler = (options = {}) => new GroupEventHandler(options);

export {
  EVENT_DEDUPLICATION_TTL_MS,
  GroupEventHandler,
  createGroupEventHandler,
  getRemovalReason,
  normalizeParticipantJid,
  renderTemplate,
};
