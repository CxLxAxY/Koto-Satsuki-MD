import makeWASocket from '@whiskeysockets/baileys';
import pino from 'pino';

const baileysLogger = pino({ level: 'silent' });

const createClient = ({ authState }) =>
  makeWASocket({
    auth: authState,
    logger: baileysLogger,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
  });

export { createClient };
export default {
  createClient,
};


