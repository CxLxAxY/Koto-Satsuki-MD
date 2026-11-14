import { sendReply } from '../../utils/formatter.js';
import logger from '../../utils/logger.js';
import { getPublicErrorMessage } from '../../services/scraper-utils/scraperError.js';

const createScraperCommand = ({
  name,
  aliases = [],
  category,
  description,
  usage,
  execute,
}) => ({
  name,
  aliases,
  category,
  description,
  usage,
  limit: false,
  premium: false,
  ownerOnly: false,
  redactArguments: true,
  execute: async (context) => {
    try {
      return await execute(context);
    } catch (error) {
      if (error?.code === 'GLOBAL_MESSAGE_SEND_FAILED') {
        throw error;
      }
      const code = error?.code || 'UPSTREAM_FAILED';
      logger.warning(`Scraper command failed: command=${name} code=${code}`);
      await sendReply(context, getPublicErrorMessage(error));
      return { status: false, code };
    }
  },
});

export { createScraperCommand };
