import { DisconnectReason } from '@whiskeysockets/baileys';
import config from '../config/config.js';
import { handleCommand } from '../handlers/commandHandler.js';
import { extractMessageText } from '../utils/messageParser.js';
import logger from '../utils/logger.js';
import { createSenderResolver, isValidPhoneNumber } from '../utils/senderResolver.js';
import { getAuthState } from './auth.js';
import { createClient } from './client.js';
import { registerEvents } from './events.js';

const getDisconnectCode = (error) => {
  const code = error?.output?.statusCode;
  return Number.isInteger(code) ? code : undefined;
};

const getDisconnectReason = (code) => {
  if (code === undefined) {
    return 'Unknown error';
  }

  const reason = Object.entries(DisconnectReason).find(
    ([, value]) => typeof value === 'number' && value === code,
  );
  return reason?.[0] || `Status ${code}`;
};

const calculateReconnectDelay = ({ attempt, baseDelayMs, maxDelayMs, jitter, random = Math.random }) => {
  const exponent = Math.min(Math.max(attempt - 1, 0), 30);
  const delay = Math.min(baseDelayMs * (2 ** exponent), maxDelayMs);
  return jitter ? Math.floor(delay * (0.5 + random() * 0.5)) : delay;
};

const PAIRING_READY_TIMEOUT_MS = 30000;

const getChatType = (jid) => (jid?.endsWith('@g.us') ? 'GROUP' : 'PRIVATE');

const createConnectionManager = ({
  appConfig = config,
  appLogger = logger,
  loadAuthState = getAuthState,
  socketFactory = createClient,
  registerSocketEvents = registerEvents,
  commandDispatcher = handleCommand,
  senderResolverFactory = createSenderResolver,
  onGroupParticipantsUpdate = () => undefined,
  onSocketReady = () => undefined,
  onSocketUnavailable = () => undefined,
} = {}) => {
  let state = 'STOPPED';
  let running = false;
  let authState;
  let socket;
  let eventCleanup;
  let reconnectTimer;
  let connectionPromise;
  let pairingPromise;
  let pairingRequestGeneration;
  let pairingCodeIssued = false;
  let reconnectAttempt = 0;
  let generation = 0;
  const senderResolver = senderResolverFactory();
  const processedMessageIds = new Set();

  const notifyLifecycle = (callback, activeSocket, label) => {
    try {
      Promise.resolve(callback(activeSocket, senderResolver.resolve)).catch((error) => {
        appLogger.error(`${label} lifecycle callback failed.`, error);
      });
    } catch (error) {
      appLogger.error(`${label} lifecycle callback failed.`, error);
    }
  };

  const removeSocketListeners = () => {
    if (eventCleanup) {
      const cleanup = eventCleanup;
      eventCleanup = undefined;
      return cleanup();
    }
    return Promise.resolve();
  };

  const rememberMessage = (message) => {
    const key = message.key;
    if (!key?.id || !key.remoteJid) {
      return true;
    }

    const id = `${key.remoteJid}:${key.participant || ''}:${key.id}`;
    if (processedMessageIds.has(id)) {
      return false;
    }
    processedMessageIds.add(id);

    if (processedMessageIds.size > 2000) {
      const oldest = processedMessageIds.values().next().value;
      if (oldest) {
        processedMessageIds.delete(oldest);
      }
    }
    return true;
  };

  const processMessage = async (message, activeSocket) => {
    if (!message?.message || message.key?.fromMe || !rememberMessage(message)) {
      return;
    }

    const receivedAt = performance.now();
    const chatJid = message.key.remoteJid || '';
    if (!chatJid || chatJid === 'status@broadcast' || chatJid.endsWith('@newsletter')) {
      return;
    }

    const text = extractMessageText(message.message);
    if (!text) {
      return;
    }

    const sender = senderResolver.resolve(message);
    const senderInfo = senderResolver.getIdentity(message);
    await commandDispatcher({
      text,
      prefix: appConfig.command.prefix,
      sender: sender.phoneNumber,
      chatType: getChatType(chatJid),
      message,
      senderInfo,
      resolveParticipant: senderResolver.resolve,
      socket: activeSocket,
      connectionState: state,
      authStatus: authState.state.creds.registered ? 'AUTHENTICATED' : 'PAIRING_REQUIRED',
      receivedAt,
    });
  };

  const scheduleReconnect = (reason) => {
    if (!running || reconnectTimer) {
      return;
    }

    reconnectAttempt += 1;
    const delay = calculateReconnectDelay({
      attempt: reconnectAttempt,
      baseDelayMs: appConfig.reconnect.baseDelayMs,
      maxDelayMs: appConfig.reconnect.maxDelayMs,
      jitter: appConfig.reconnect.jitter,
    });
    state = 'RECONNECT_WAIT';
    appLogger.reconnect(
      `Reason: ${reason} | Attempt: ${reconnectAttempt} | Next retry: ${(delay / 1000).toFixed(1)} seconds`,
    );

    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, delay);
  };

  const handleConnectionUpdate = (activeSocket, socketGeneration, update) => {
    if (!running || socket !== activeSocket || generation !== socketGeneration) {
      return;
    }

    if (update.connection === 'open') {
      const becameConnected = state !== 'CONNECTED';
      state = 'CONNECTED';
      reconnectAttempt = 0;
      appLogger.whatsapp('Connection established.');
      appLogger.auth('Authentication ready.');
      if (becameConnected) {
        notifyLifecycle(onSocketReady, activeSocket, 'Socket-ready');
      }
      return;
    }

    if (update.connection !== 'close') {
      return;
    }

    const code = getDisconnectCode(update.lastDisconnect?.error);
    const reason = getDisconnectReason(code);
    appLogger.whatsapp(`Connection closed. Reason: ${reason}`);

    notifyLifecycle(onSocketUnavailable, activeSocket, 'Socket-unavailable');
    socket = undefined;
    void removeSocketListeners();
    pairingCodeIssued = false;
    pairingRequestGeneration = undefined;

    const terminalReasons = new Set([
      DisconnectReason.loggedOut,
      DisconnectReason.badSession,
      DisconnectReason.connectionReplaced,
      DisconnectReason.forbidden,
      DisconnectReason.multideviceMismatch,
    ]);

    if (terminalReasons.has(code)) {
      state = 'STOPPED';
      running = false;
      appLogger.warning('Automatic reconnect stopped. Review the authentication session or linked devices.');
      return;
    }

    scheduleReconnect(reason);
  };

  const requestPairingCode = async (activeSocket, socketGeneration) => {
    if (
      authState.state.creds.registered ||
      pairingCodeIssued ||
      pairingRequestGeneration === socketGeneration ||
      pairingPromise ||
      !running ||
      socket !== activeSocket
    ) {
      return;
    }

    pairingRequestGeneration = socketGeneration;
    const request = Promise.resolve().then(async () => {
      await activeSocket.waitForConnectionUpdate(
        (update) => Boolean(update.qr),
        PAIRING_READY_TIMEOUT_MS,
      );

      if (
        !running ||
        socket !== activeSocket ||
        generation !== socketGeneration ||
        authState.state.creds.registered
      ) {
        return undefined;
      }

      return activeSocket.requestPairingCode(appConfig.whatsapp.phoneNumber);
    });
    pairingPromise = request;

    try {
      const code = await request;
      if (
        code &&
        running &&
        socket === activeSocket &&
        generation === socketGeneration &&
        !authState.state.creds.registered
      ) {
        pairingCodeIssued = true;
        appLogger.pairing(code);
      }
    } catch (error) {
      if (running && socket === activeSocket && generation === socketGeneration) {
        appLogger.error('Pairing code request failed.', error);
        notifyLifecycle(onSocketUnavailable, activeSocket, 'Socket-unavailable');
        socket = undefined;
        await removeSocketListeners();
        try {
          activeSocket.end(error);
        } catch (closeError) {
          appLogger.error('Failed to close socket after pairing error.', closeError);
        }
        scheduleReconnect('Pairing code request failed');
      }
    } finally {
      if (pairingPromise === request) {
        pairingPromise = undefined;
      }

      if (
        running &&
        socket &&
        socket !== activeSocket &&
        !authState.state.creds.registered &&
        !pairingCodeIssued
      ) {
        void requestPairingCode(socket, generation);
      }
    }
  };

  const connect = async () => {
    if (!running || socket || connectionPromise) {
      return;
    }

    connectionPromise = (async () => {
      state = 'CONNECTING';
      const socketGeneration = ++generation;
      let activeSocket;

      try {
        appLogger.whatsapp('Connecting...');
        activeSocket = socketFactory({ authState: authState.state });
        socket = activeSocket;
        eventCleanup = registerSocketEvents(activeSocket, {
          saveCreds: authState.saveCreds,
          onConnectionUpdate: (update) =>
            handleConnectionUpdate(activeSocket, socketGeneration, update),
          onMessagesUpsert: async ({ messages, type }) => {
            if (type !== 'notify') {
              return;
            }
            for (const message of messages) {
              try {
                await processMessage(message, activeSocket);
              } catch (error) {
                appLogger.error('Failed to process incoming message.', error);
              }
            }
          },
          onLidMappingUpdate: (mapping) => senderResolver.rememberLidMapping(mapping),
          onGroupParticipantsUpdate: (update) =>
            onGroupParticipantsUpdate(update, activeSocket, senderResolver.resolve),
        });

        if (!authState.state.creds.registered) {
          void requestPairingCode(activeSocket, socketGeneration);
        }
      } catch (error) {
        if (activeSocket && socket === activeSocket) {
          notifyLifecycle(onSocketUnavailable, activeSocket, 'Socket-unavailable');
          socket = undefined;
          await removeSocketListeners();
          try {
            activeSocket.end(error);
          } catch (closeError) {
            appLogger.error('Failed to close socket after connection error.', closeError);
          }
        }
        appLogger.error('Failed to create WhatsApp connection.', error);
        scheduleReconnect('Socket initialization failed');
      }
    })();

    try {
      await connectionPromise;
    } finally {
      connectionPromise = undefined;
    }
  };

  const start = async () => {
    if (running) {
      return;
    }

    running = true;
    state = 'CONNECTING';

    try {
      authState = await loadAuthState(appConfig.paths.auth);
    } catch (error) {
      running = false;
      state = 'STOPPED';
      appLogger.error('Failed to load authentication state. Check the auth directory and its contents.', error);
      throw error;
    }

    appLogger.auth('Authentication loaded.');
    if (!authState.state.creds.registered && !isValidPhoneNumber(appConfig.whatsapp.phoneNumber)) {
      running = false;
      state = 'STOPPED';
      throw new Error(
        'WHATSAPP_PHONE_NUMBER is required for pairing and must contain 8–15 digits including the country code.',
      );
    }

    await connect();
  };

  const stop = async () => {
    if (!running && state === 'STOPPED') {
      return;
    }

    running = false;
    state = 'STOPPING';
    generation += 1;
    pairingCodeIssued = false;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }

    const activeSocket = socket;
    socket = undefined;
    await removeSocketListeners();

    if (activeSocket) {
      notifyLifecycle(onSocketUnavailable, activeSocket, 'Socket-unavailable');
      try {
        activeSocket.end(new Error('Koto Satsuki is shutting down'));
      } catch (error) {
        appLogger.error('Failed to close WhatsApp connection cleanly.', error);
      }
    }

    state = 'STOPPED';
    appLogger.system('Koto Satsuki stopped.');
  };

  return {
    start,
    stop,
    getState: () => state,
  };
};

export { calculateReconnectDelay, createConnectionManager };
export default {
  calculateReconnectDelay,
  createConnectionManager,
};


