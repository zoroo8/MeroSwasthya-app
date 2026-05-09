const jwt = require('jsonwebtoken');
const { createChatMessage } = require('../services/chatService');

const getUserRoom = (userId) => `user:${userId}`;

const getRecipientUserId = ({ senderRole, doctor, patient }) => {
  if (senderRole === 'patient') {
    return doctor.user?._id;
  }

  return patient._id;
};

const initChatSocket = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;

      if (!token) {
        return next(new Error('Authentication token is required'));
      }

      if (!process.env.JWT_SECRET) {
        return next(new Error('JWT_SECRET is not configured'));
      }

      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (_err) {
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(getUserRoom(socket.user.id));

    socket.on('chat:send', async (payload, callback) => {
      try {
        const result = await createChatMessage({
          user: socket.user,
          doctorId: payload?.doctorId,
          patientUserId: payload?.patientUserId,
          message: payload?.message,
        });

        if (result.error) {
          if (callback) {
            callback({ ok: false, message: result.error.message });
          }
          return;
        }

        const eventPayload = {
          doctor: result.conversation.doctor,
          patient: result.conversation.patient,
          conversation: result.conversation,
          message: result.message,
        };
        const senderRoom = getUserRoom(socket.user.id);
        const recipientUserId = getRecipientUserId({
          senderRole: socket.user.role,
          doctor: result.doctor,
          patient: result.patient,
        });

        if (callback) {
          callback({ ok: true, ...eventPayload });
        }

        socket.to(senderRoom).emit('chat:message', eventPayload);
        if (recipientUserId) {
          io.to(getUserRoom(recipientUserId)).emit('chat:message', eventPayload);
        }
      } catch (err) {
        if (callback) {
          callback({ ok: false, message: err.message || 'Unable to send message' });
        }
      }
    });
  });
};

module.exports = {
  initChatSocket,
};
