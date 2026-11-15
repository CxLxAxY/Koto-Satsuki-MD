import config from '../../../config/config.js';

const MEMBER_EVENT_DEDUPLICATION_MS = 30000;
const MAX_DEDUPLICATED_EVENTS = 5000;
const GROUP_JID_PATTERN = /^\d+(?:-\d+)?@g\.us$/u;
const USER_JID_PATTERN = /^[^@\s]{1,128}@(s\.whatsapp\.net|lid)$/u;

const getEventFingerprint = (update) => {
  if (
    !GROUP_JID_PATTERN.test(update?.id || '') ||
    !['add', 'remove', 'promote', 'demote'].includes(update?.action) ||
    !Array.isArray(update?.participants) ||
    update.participants.length === 0 ||
    update.participants.length > 100
  ) {
    return undefined;
  }
  const participants = update.participants.map((participant) =>
    typeof participant === 'string'
      ? participant
      : participant?.id || participant?.jid || participant?.participant,
  );
  if (participants.some((participant) => !USER_JID_PATTERN.test(participant || ''))) {
    return undefined;
  }
  return `${update.id}\0${update.action}\0${[...new Set(participants)].sort().join('\0')}`;
};

class WhatsAppMemberScraper {
  constructor({
    store,
    enabled = config.whatsappData.collectionEnabled,
    now = Date.now,
  } = {}) {
    if (!store) {
      throw new TypeError('WhatsApp member scraper requires a data store.');
    }
    this.store = store;
    this.enabled = enabled;
    this.now = now;
    this.recentEvents = new Map();
  }

  async collect(update) {
    if (!this.enabled) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'COLLECTION_DISABLED',
          message: 'Pengumpulan WhatsApp dinonaktifkan oleh konfigurasi.',
        },
      };
    }
    if (typeof update?.id !== 'string' || !/^\d+(?:-\d+)?@g\.us$/u.test(update.id)) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'INVALID_EVENT',
          message: 'Event anggota grup tidak valid.',
        },
      };
    }
    const fingerprint = getEventFingerprint(update);
    if (!fingerprint) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'INVALID_EVENT',
          message: 'Event anggota grup tidak valid.',
        },
      };
    }
    if (!(await this.store.hasMemberConsent(update?.id))) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Persetujuan statistik agregat grup belum diberikan.',
        },
      };
    }
    const now = this.now();
    for (const [key, expiresAt] of this.recentEvents) {
      if (expiresAt <= now) {
        this.recentEvents.delete(key);
      }
    }
    if (this.recentEvents.has(fingerprint)) {
      return {
        success: true,
        source: 'whatsapp',
        type: 'member',
        collectedAt: new Date(now).toISOString(),
        count: 0,
        data: [],
        metadata: { reason: 'DUPLICATE' },
      };
    }
    if (this.recentEvents.size >= MAX_DEDUPLICATED_EVENTS) {
      const oldest = this.recentEvents.keys().next().value;
      if (oldest) {
        this.recentEvents.delete(oldest);
      }
    }
    this.recentEvents.set(fingerprint, now + MEMBER_EVENT_DEDUPLICATION_MS);
    let result;
    try {
      result = await this.store.recordMemberEvent(update);
    } catch (error) {
      this.recentEvents.delete(fingerprint);
      throw error;
    }
    if (!result.stored) {
      this.recentEvents.delete(fingerprint);
    }
    if (result.reason === 'CONSENT_REQUIRED') {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Persetujuan statistik agregat grup belum diberikan.',
        },
      };
    }
    return {
      success: true,
      source: 'whatsapp',
      type: 'member',
      collectedAt: new Date().toISOString(),
      count: result.stored ? 1 : 0,
      data: [],
      metadata: { reason: result.reason },
    };
  }

  async getStats({ groupJid } = {}) {
    const data = await this.store.getMemberStats(groupJid);
    return {
      success: true,
      source: 'whatsapp',
      type: 'member',
      collectedAt: new Date().toISOString(),
      count: data.eventCount,
      data,
      metadata: {},
    };
  }

  async getConsent({ groupJid } = {}) {
    return {
      success: true,
      source: 'whatsapp',
      type: 'member',
      collectedAt: new Date().toISOString(),
      count: 1,
      data: { consented: await this.store.hasMemberConsent(groupJid) },
      metadata: {},
    };
  }

  async setConsent({ groupJid, enabled } = {}) {
    if (enabled && !this.enabled) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'member',
        error: {
          code: 'COLLECTION_DISABLED',
          message: 'Pengumpulan WhatsApp dinonaktifkan oleh konfigurasi.',
        },
      };
    }
    await this.store.setMemberConsent(groupJid, enabled);
    return {
      success: true,
      source: 'whatsapp',
      type: 'member',
      collectedAt: new Date().toISOString(),
      count: 1,
      data: { consented: enabled },
      metadata: {},
    };
  }

  async deleteData({ groupJid } = {}) {
    const count = await this.store.deleteMemberStats(groupJid);
    return { success: true, source: 'whatsapp', type: 'member', count, data: [] };
  }
}

const createWhatsAppMemberScraper = (options) =>
  new WhatsAppMemberScraper(options);

export { WhatsAppMemberScraper, createWhatsAppMemberScraper };
