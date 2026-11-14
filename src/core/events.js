import logger from '../utils/logger.js';

const registerEvents = (
  socket,
  {
    saveCreds,
    onConnectionUpdate,
    onMessagesUpsert,
    onLidMappingUpdate,
    onGroupParticipantsUpdate = async () => undefined,
  },
) => {
  let credentialSaveQueue = Promise.resolve();

  const handleCredentialsUpdate = () => {
    credentialSaveQueue = credentialSaveQueue
      .then(() => saveCreds())
      .catch((error) => {
        logger.error('Failed to persist authentication credentials.', error);
      });
  };
  const handleConnectionUpdate = (update) => onConnectionUpdate(update);
  const handleMessagesUpsert = (event) => {
    Promise.resolve(onMessagesUpsert(event)).catch((error) => {
      logger.error('Failed to process message event.', error);
    });
  };
  const handleLidMappingUpdate = (mapping) => onLidMappingUpdate(mapping);
  const handleGroupParticipantsUpdate = (update) => {
    Promise.resolve().then(() => onGroupParticipantsUpdate(update)).catch((error) => {
      logger.error('Failed to process group participant event.', error);
    });
  };

  socket.ev.on('creds.update', handleCredentialsUpdate);
  socket.ev.on('connection.update', handleConnectionUpdate);
  socket.ev.on('messages.upsert', handleMessagesUpsert);
  socket.ev.on('lid-mapping.update', handleLidMappingUpdate);
  socket.ev.on('group-participants.update', handleGroupParticipantsUpdate);

  return () => {
    socket.ev.off('creds.update', handleCredentialsUpdate);
    socket.ev.off('connection.update', handleConnectionUpdate);
    socket.ev.off('messages.upsert', handleMessagesUpsert);
    socket.ev.off('lid-mapping.update', handleLidMappingUpdate);
    socket.ev.off('group-participants.update', handleGroupParticipantsUpdate);
    return credentialSaveQueue;
  };
};

export { registerEvents };
export default {
  registerEvents,
};


