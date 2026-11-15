import { whatsappArchiveStore } from '../../services/whatsapp-data/index.js';
import { createWhatsAppMemberScraper } from './members/index.js';
import { createWhatsAppMessageScraper } from './messages/index.js';

const messageScraper = createWhatsAppMessageScraper({
  store: whatsappArchiveStore,
});
const memberScraper = createWhatsAppMemberScraper({
  store: whatsappArchiveStore,
});

export { memberScraper, messageScraper };
