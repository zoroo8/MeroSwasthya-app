const {
  createChatMessage,
  getConversationsForUser,
  getMessagesForConversation,
  toDoctorSummary,
  toPatientSummary,
} = require('../services/chatService');

const getMyConversations = async (req, res) => {
  try {
    const { conversations, error } = await getConversationsForUser(req.user);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMessages = async (req, res) => {
  try {
    const doctorId = req.query.doctorId;
    const patientUserId = req.user.role === 'patient' ? req.user.id : req.query.patientUserId;
    const { doctor, patient, messages, error } = await getMessagesForConversation({
      user: req.user,
      doctorId,
      patientUserId,
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.json({
      doctor: toDoctorSummary(doctor),
      patient: toPatientSummary(patient),
      messages,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const sendMessage = async (req, res) => {
  try {
    const { message, error } = await createChatMessage({
      user: req.user,
      doctorId: req.body.doctorId,
      patientUserId: req.body.patientUserId,
      message: req.body.message,
    });

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMyConversations,
  getMessages,
  sendMessage,
};
