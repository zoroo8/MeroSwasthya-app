const ChatMessage = require('../models/ChatMessage');
const Doctor = require('../models/Doctor');
const User = require('../models/User');

const toDoctorSummary = (doctor) => ({
  id: doctor._id,
  name: doctor.user?.name || 'Doctor',
  email: doctor.user?.email,
  phone: doctor.user?.phone,
  profileImage: doctor.user?.profileImage,
  specialty: doctor.specialty,
});

const toPatientSummary = (patient) => ({
  id: patient._id,
  name: patient.name,
  email: patient.email,
  phone: patient.phone,
  profileImage: patient.profileImage,
});

const toMessageSummary = (message) => {
  if (!message) return null;

  return {
    id: message._id,
    _id: message._id,
    message: message.message,
    createdAt: message.createdAt,
    senderUser: message.senderUser
      ? {
          id: message.senderUser._id,
          _id: message.senderUser._id,
          name: message.senderUser.name,
          role: message.senderUser.role,
          profileImage: message.senderUser.profileImage,
        }
      : null,
  };
};

const getDoctorForUser = (userId) => {
  return Doctor.findOne({ user: userId }).populate('user', 'name email phone profileImage');
};

const assertChatAccess = async ({ user, doctorId, patientUserId, requireStartedForDoctor = false }) => {
  if (!doctorId || !patientUserId) {
    return { error: { status: 400, message: 'doctorId and patientUserId are required' } };
  }

  const doctor = await Doctor.findById(doctorId).populate('user', 'name email phone profileImage');
  if (!doctor || !doctor.isApproved) {
    return { error: { status: 404, message: 'Approved doctor not found' } };
  }

  const patient = await User.findById(patientUserId).select('name email phone profileImage role');
  if (!patient || patient.role !== 'patient') {
    return { error: { status: 404, message: 'Patient not found' } };
  }

  if (user.role === 'patient' && String(patient._id) !== String(user.id)) {
    return { error: { status: 403, message: 'Access denied' } };
  }

  if (user.role === 'doctor') {
    const currentDoctor = await getDoctorForUser(user.id);
    if (!currentDoctor || String(currentDoctor._id) !== String(doctor._id)) {
      return { error: { status: 403, message: 'Access denied' } };
    }

    if (requireStartedForDoctor) {
      const firstMessage = await ChatMessage.findOne({ patientUser: patient._id, doctor: doctor._id })
        .sort({ createdAt: 1 })
        .select('senderUser');

      if (!firstMessage || String(firstMessage.senderUser) !== String(patient._id)) {
        return {
          error: {
            status: 403,
            message: 'Patients must send the first message before a doctor can reply',
          },
        };
      }
    }
  }

  return { doctor, patient };
};

const getLatestMessage = ({ patientUserId, doctorId }) => {
  return ChatMessage.findOne({ patientUser: patientUserId, doctor: doctorId })
    .sort({ createdAt: -1 })
    .populate('senderUser', 'name role profileImage');
};

const getConversationPayload = async ({ doctor, patient }) => {
  return {
    doctor: toDoctorSummary(doctor),
    patient: toPatientSummary(patient),
    lastMessage: toMessageSummary(await getLatestMessage({
      patientUserId: patient._id,
      doctorId: doctor._id,
    })),
  };
};

const getConversationsForUser = async (user) => {
  let filter;
  let doctorForCurrentUser = null;

  if (user.role === 'patient') {
    filter = { patientUser: user.id };
  } else {
    doctorForCurrentUser = await getDoctorForUser(user.id);
    if (!doctorForCurrentUser) {
      return { error: { status: 404, message: 'Doctor profile not found' } };
    }
    filter = { doctor: doctorForCurrentUser._id };
  }

  const messages = await ChatMessage.find(filter)
    .populate('patientUser', 'name email phone profileImage')
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone profileImage' } })
    .populate('senderUser', 'name role profileImage')
    .sort({ createdAt: -1 });

  const byConversation = new Map();
  messages.forEach((message) => {
    if (!message.patientUser || !message.doctor) return;

    const key = `${message.doctor._id}-${message.patientUser._id}`;
    if (byConversation.has(key)) return;

    byConversation.set(key, {
      doctor: toDoctorSummary(message.doctor),
      patient: toPatientSummary(message.patientUser),
      lastMessage: toMessageSummary(message),
    });
  });

  return { conversations: [...byConversation.values()] };
};

const getMessagesForConversation = async ({ user, doctorId, patientUserId }) => {
  const { doctor, patient, error } = await assertChatAccess({
    user,
    doctorId,
    patientUserId,
    requireStartedForDoctor: user.role === 'doctor',
  });

  if (error) return { error };

  const messages = await ChatMessage.find({ patientUser: patient._id, doctor: doctor._id })
    .populate('senderUser', 'name email role profileImage')
    .sort({ createdAt: 1 });

  return {
    doctor,
    patient,
    messages,
  };
};

const createChatMessage = async ({ user, doctorId, patientUserId, message }) => {
  const messageText = String(message || '').trim();

  if (!messageText) {
    return { error: { status: 400, message: 'Message is required' } };
  }

  if (messageText.length > 1000) {
    return { error: { status: 400, message: 'Message must be 1000 characters or fewer' } };
  }

  const resolvedDoctorId = user.role === 'doctor'
    ? doctorId || (await getDoctorForUser(user.id))?._id
    : doctorId;
  const resolvedPatientUserId = user.role === 'patient' ? user.id : patientUserId;

  const { doctor, patient, error } = await assertChatAccess({
    user,
    doctorId: resolvedDoctorId,
    patientUserId: resolvedPatientUserId,
    requireStartedForDoctor: user.role === 'doctor',
  });

  if (error) return { error };

  const saved = await ChatMessage.create({
    patientUser: patient._id,
    doctor: doctor._id,
    senderUser: user.id,
    message: messageText,
  });

  const populated = await ChatMessage.findById(saved._id).populate('senderUser', 'name email role profileImage');
  const conversation = await getConversationPayload({ doctor, patient });

  return {
    doctor,
    patient,
    message: populated,
    conversation,
  };
};

module.exports = {
  assertChatAccess,
  createChatMessage,
  getConversationsForUser,
  getMessagesForConversation,
  toDoctorSummary,
  toPatientSummary,
};
