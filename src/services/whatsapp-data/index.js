import config from '../../config/config.js';
import { createWhatsAppArchiveStore } from './archiveStore.js';

const whatsappArchiveStore = createWhatsAppArchiveStore(
  config.paths.whatsappData,
  { retentionDays: config.whatsappData.retentionDays },
);

export { whatsappArchiveStore };
