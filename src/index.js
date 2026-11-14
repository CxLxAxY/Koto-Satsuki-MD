import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGroupEventHandler } from './core/groupEvents.js';
import { groupConfigStore, groupScheduler } from './core/groupScheduler.js';
import { registerGeneralCommands } from './commands/general/index.js';
import { registerGroupCommands } from './commands/group/index.js';
import { registerAnimeCommands } from './commands/anime/index.js';
import { registerComicCommands } from './commands/comic/index.js';
import { registerDownloaderCommands } from './commands/downloader/index.js';
import { registerResolverCommands } from './commands/resolver/index.js';
import { validateConfig } from './config/config.js';
import { createConnectionManager } from './core/connection.js';
import { warnNewsletterUnavailable } from './utils/newsletterContext.js';
import logger from './utils/logger.js';

let connectionManager;
let shutdownPromise;
const groupEventHandler = createGroupEventHandler({ store: groupConfigStore });

const start = async () => {
  if (connectionManager) {
    return;
  }

  validateConfig();
  warnNewsletterUnavailable();
  registerGeneralCommands();
  registerDownloaderCommands();
  registerResolverCommands();
  registerAnimeCommands();
  registerComicCommands();
  registerGroupCommands();
  process.umask(0o077);
  logger.system('Koto Satsuki starting...');
  await groupConfigStore.load();
  await groupScheduler.start();
  connectionManager = createConnectionManager({
    onGroupParticipantsUpdate: (update, socket, resolveParticipant) =>
      groupEventHandler.handle(update, socket, resolveParticipant),
    onSocketReady: (socket, resolveParticipant) =>
      groupScheduler.setSocket(socket, resolveParticipant),
    onSocketUnavailable: (socket) => groupScheduler.clearSocket(socket),
  });
  try {
    await connectionManager.start();
  } catch (error) {
    const failedManager = connectionManager;
    connectionManager = undefined;
    try {
      await failedManager.stop();
    } catch (cleanupError) {
      logger.error('Failed to clean up connection manager after startup failure.', cleanupError);
    }
    try {
      await groupScheduler.stop();
    } catch (cleanupError) {
      logger.error('Failed to stop group scheduler after startup failure.', cleanupError);
    }
    throw error;
  }
};

const stop = async () => {
  if (!connectionManager) {
    await groupScheduler.stop();
    return;
  }
  const activeManager = connectionManager;
  connectionManager = undefined;
  try {
    await activeManager.stop();
  } finally {
    await groupScheduler.stop();
  }
};

const handleShutdown = (signal) => {
  if (shutdownPromise) {
    return shutdownPromise;
  }
  logger.system(`Received ${signal}; shutting down.`);
  shutdownPromise = stop().catch((error) => {
    logger.error('Graceful shutdown failed.', error);
    process.exitCode = 1;
  });
  return shutdownPromise;
};

process.once('SIGINT', () => void handleShutdown('SIGINT'));
process.once('SIGTERM', () => void handleShutdown('SIGTERM'));

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  start().catch((error) => {
    logger.error('Koto Satsuki failed to start.', error);
    process.exitCode = 1;
  });
}

export { start, stop };
export default { start, stop };


