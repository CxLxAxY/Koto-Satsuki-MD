import config from '../../../config/config.js';
import { normalizeWhatsAppTextMessage } from './normalizer.js';

class WhatsAppMessageScraper {
  constructor({
    store,
    enabled = config.whatsappData.collectionEnabled,
    prefix = config.command.prefix,
  } = {}) {
    if (!store) {
      throw new TypeError('WhatsApp message scraper requires a data store.');
    }
    this.store = store;
    this.enabled = enabled;
    this.prefix = prefix;
  }

  async collect(message) {
    if (!this.enabled) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'message',
        error: {
          code: 'COLLECTION_DISABLED',
          message: 'Pengumpulan WhatsApp dinonaktifkan oleh konfigurasi.',
        },
      };
    }
    const normalized = normalizeWhatsAppTextMessage(message, { prefix: this.prefix });
    if (!normalized) {
      return {
        success: true,
        source: 'whatsapp',
        type: 'message',
        collectedAt: new Date().toISOString(),
        count: 0,
        data: [],
        metadata: { reason: 'INELIGIBLE_MESSAGE' },
      };
    }
    const result = await this.store.recordMessage(normalized.senderJid, normalized);
    if (result.reason === 'CONSENT_REQUIRED') {
      return {
        success: false,
        source: 'whatsapp',
        type: 'message',
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Persetujuan pengarsipan untuk chat ini belum diberikan.',
        },
      };
    }
    return {
      success: true,
      source: 'whatsapp',
      type: 'message',
      collectedAt: new Date().toISOString(),
      count: result.stored ? 1 : 0,
      data: [],
      metadata: { reason: result.reason },
    };
  }

  async getConsent({ identity, scope } = {}) {
    return {
      success: true,
      source: 'whatsapp',
      type: 'message',
      collectedAt: new Date().toISOString(),
      count: 1,
      data: { consented: await this.store.hasConsent(identity, scope) },
      metadata: {},
    };
  }

  async setConsent({ identity, scope, enabled } = {}) {
    if (enabled && !this.enabled) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'message',
        error: {
          code: 'COLLECTION_DISABLED',
          message: 'Pengumpulan WhatsApp dinonaktifkan oleh konfigurasi.',
        },
      };
    }
    await this.store.setConsent(identity, scope, enabled);
    return {
      success: true,
      source: 'whatsapp',
      type: 'message',
      collectedAt: new Date().toISOString(),
      count: 1,
      data: { consented: enabled },
      metadata: {},
    };
  }

  async getStats({ identity, scope } = {}) {
    if (scope && !(await this.store.hasConsent(identity, scope))) {
      return {
        success: false,
        source: 'whatsapp',
        type: 'message',
        error: {
          code: 'CONSENT_REQUIRED',
          message: 'Persetujuan arsip untuk cakupan ini belum diberikan.',
        },
      };
    }
    const data = await this.store.getUserMessages(identity, { limit: 2000 });
    return {
      success: true,
      source: 'whatsapp',
      type: 'message',
      collectedAt: new Date().toISOString(),
      count: data.length,
      data,
      metadata: {},
    };
  }

  async deleteData({ identity, scope } = {}) {
    if (scope) {
      await this.store.setConsent(identity, scope, false);
      return { success: true, source: 'whatsapp', type: 'message', count: 0, data: [] };
    }
    const count = await this.store.deleteUserData(identity);
    return { success: true, source: 'whatsapp', type: 'message', count, data: [] };
  }
}

const createWhatsAppMessageScraper = (options) =>
  new WhatsAppMessageScraper(options);

export { WhatsAppMessageScraper, createWhatsAppMessageScraper };
