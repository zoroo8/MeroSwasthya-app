const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const DoctorHospital = require('../models/DoctorHospital');

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const APPOINTMENT_SLOT_MINUTES = 30;
const APPOINTMENT_START_HOUR = 9;
const APPOINTMENT_START_MINUTE = 0;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toPositiveLimit = (value, fallback = 10) => {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : fallback;
};

const getAvailabilitySlots = (link) => {
  if (link?.availabilitySlots?.length > 0) {
    return link.availabilitySlots.map((slot) => ({
      date: slot.date,
      maxDailyBookings: toPositiveLimit(slot.maxDailyBookings, link.maxDailyBookings),
    }));
  }

  const dates = Array.isArray(link?.availableDates) ? link.availableDates : [];
  return dates
    .filter((date) => DATE_KEY_REGEX.test(date))
    .map((date) => ({
      date,
      maxDailyBookings: toPositiveLimit(link?.maxDailyBookings),
    }));
};

const getAvailabilitySlot = (link, appointmentDate) => {
  return getAvailabilitySlots(link).find((slot) => slot.date === appointmentDate);
};

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayKey = () => toDateKey(new Date());

const getQueueDate = ({ appointmentDate, scheduledAt }) => {
  if (appointmentDate && DATE_KEY_REGEX.test(String(appointmentDate))) {
    return String(appointmentDate);
  }

  if (!scheduledAt) {
    return null;
  }

  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return toDateKey(date);
};

const getScheduledAtForQueue = (queueDate, queueNumber) => {
  const [year, month, day] = queueDate.split('-').map(Number);
  const scheduledAt = new Date(year, month - 1, day, APPOINTMENT_START_HOUR, APPOINTMENT_START_MINUTE, 0, 0);
  scheduledAt.setMinutes(scheduledAt.getMinutes() + (queueNumber - 1) * APPOINTMENT_SLOT_MINUTES);
  return scheduledAt;
};

const getMinimumFutureQueueNumber = (queueDate) => {
  const firstSlot = getScheduledAtForQueue(queueDate, 1);
  const now = Date.now();

  if (firstSlot.getTime() > now) {
    return 1;
  }

  const elapsedMs = now - firstSlot.getTime();
  return Math.floor(elapsedMs / (APPOINTMENT_SLOT_MINUTES * 60 * 1000)) + 2;
};

const validateAppointmentInput = ({ appointmentDate, scheduledAt, reason }) => {
  if (!reason) {
    return { error: 'reason is required' };
  }

  const queueDate = getQueueDate({ appointmentDate, scheduledAt });
  if (!queueDate) {
    return { error: 'appointmentDate is required in YYYY-MM-DD format' };
  }

  if (queueDate < getTodayKey()) {
    return { error: 'Appointment date must be today or in the future' };
  }

  return { queueDate };
};

const getDoctorOrError = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    return { error: { status: 404, message: 'Doctor not found' } };
  }

  if (!doctor.isApproved) {
    return { error: { status: 400, message: 'Doctor is not approved yet' } };
  }

  return { doctor };
};

const getBookingSnapshot = async ({ doctorId, hospitalId, queueDate }) => {
  const hospitalMatch = hospitalId ? hospitalId : { $exists: false };
  const filter = {
    doctor: doctorId,
    hospitalId: hospitalMatch,
    queueDate,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  };

  const [activeCount, latestAppointment] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.findOne({ doctor: doctorId, hospitalId: hospitalMatch, queueDate })
      .sort({ queueNumber: -1 })
      .select('queueNumber'),
  ]);

  const minimumFutureQueueNumber = getMinimumFutureQueueNumber(queueDate);

  return {
    activeCount,
    nextQueueNumber: Math.max((latestAppointment?.queueNumber || 0) + 1, minimumFutureQueueNumber),
  };
};

const getDoctorAvailabilityForDate = (link, appointmentDate) => {
  const slots = getAvailabilitySlots(link);

  if (slots.length === 0) {
    return {
      error: 'No availability dates are configured for this doctor in this hospital',
    };
  }

  const slot = getAvailabilitySlot(link, appointmentDate);
  if (!slot) {
    return {
      error: 'Doctor is not available at this hospital on the selected date',
    };
  }

  return { slot };
};

const createAppointmentWithQueue = async ({
  patientUserId,
  doctor,
  hospitalId,
  maxDailyBookings,
  queueDate,
  reason,
  notes,
}) => {
  const { activeCount, nextQueueNumber } = await getBookingSnapshot({
    doctorId: doctor._id,
    hospitalId,
    queueDate,
  });

  if (activeCount >= maxDailyBookings || nextQueueNumber > maxDailyBookings) {
    return {
      error: {
        status: 400,
        message: `No appointment slots remain for this date. Max daily booking is ${maxDailyBookings}`,
      },
    };
  }

  const scheduledAt = getScheduledAtForQueue(queueDate, nextQueueNumber);

  const appointment = await Appointment.create({
    patientUser: patientUserId,
    doctor: doctor._id,
    hospitalId: hospitalId || undefined,
    scheduledAt,
    queueDate,
    queueNumber: nextQueueNumber,
    reason: reason.trim(),
    notes,
  });

  return { appointment };
};

const getHospitalDoctorLink = async ({ doctorId, hospitalId }) => {
  return DoctorHospital.findOne({
    doctor: doctorId,
    hospital: hospitalId,
    isActive: true,
  });
};

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, appointmentDate, scheduledAt, reason, notes } = req.body;
    const { queueDate, error: validationError } = validateAppointmentInput({ appointmentDate, scheduledAt, reason });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (!doctorId) {
      return res.status(400).json({ message: 'doctorId is required' });
    }

    const { doctor, error } = await getDoctorOrError(doctorId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor,
      hospitalId: null,
      maxDailyBookings: doctor.maxDailyBookings,
      queueDate,
      reason,
      notes,
    });

    if (bookingError) {
      return res.status(bookingError.status).json({ message: bookingError.message });
    }

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
      queueNumber: appointment.queueNumber,
      queueDate: appointment.queueDate,
      scheduledAt: appointment.scheduledAt,
      slotMinutes: APPOINTMENT_SLOT_MINUTES,
      maxDailyBookings: doctor.maxDailyBookings,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Queue conflict occurred. Please retry booking.' });
    }
    res.status(500).json({ message: err.message });
  }
};

const bookFromHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId, appointmentDate, scheduledAt, reason, notes } = req.body;

    if (!hospitalId) {
      return res.status(400).json({ message: 'hospitalId is required' });
    }

    const { queueDate, error: validationError } = validateAppointmentInput({ appointmentDate, scheduledAt, reason });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (!doctorId) {
      return res.status(400).json({ message: 'doctorId is required' });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    const { doctor, error } = await getDoctorOrError(doctorId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const link = await getHospitalDoctorLink({ doctorId: doctor._id, hospitalId: hospital._id });
    if (!link) {
      return res.status(400).json({ message: 'Selected doctor is not hired by this hospital' });
    }

    const { slot, error: availabilityError } = getDoctorAvailabilityForDate(link, queueDate);
    if (availabilityError) {
      return res.status(400).json({ message: availabilityError });
    }

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor,
      hospitalId: hospital._id,
      maxDailyBookings: slot.maxDailyBookings,
      queueDate,
      reason,
      notes,
    });

    if (bookingError) {
      return res.status(bookingError.status).json({ message: bookingError.message });
    }

    res.status(201).json({
      message: 'Hospital doctor appointed successfully',
      appointment,
      queueNumber: appointment.queueNumber,
      queueDate: appointment.queueDate,
      scheduledAt: appointment.scheduledAt,
      slotMinutes: APPOINTMENT_SLOT_MINUTES,
      maxDailyBookings: slot.maxDailyBookings,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Queue conflict occurred. Please retry booking.' });
    }
    res.status(500).json({ message: err.message });
  }
};

const bookBySpecialty = async (req, res) => {
  try {
    const { hospitalId, specialty, appointmentDate, scheduledAt, reason, notes } = req.body;

    if (!hospitalId || !specialty) {
      return res.status(400).json({ message: 'hospitalId and specialty are required' });
    }

    const { queueDate, error: validationError } = validateAppointmentInput({ appointmentDate, scheduledAt, reason });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    const specialtyRegex = new RegExp(`^${escapeRegex(specialty.trim())}$`, 'i');

    const doctors = await Doctor.find({ isApproved: true, specialty: specialtyRegex })
      .sort({ experienceYears: -1 })
      .select('_id specialty experienceYears');

    if (doctors.length === 0) {
      return res.status(404).json({ message: 'No approved doctor found for this specialty' });
    }

    const links = await DoctorHospital.find({
      hospital: hospital._id,
      doctor: { $in: doctors.map((doc) => doc._id) },
      isActive: true,
      $or: [{ 'availabilitySlots.date': queueDate }, { availableDates: queueDate }],
    });

    if (links.length === 0) {
      return res.status(404).json({ message: 'No hired doctor found for this specialty in selected hospital' });
    }

    const linkByDoctorId = new Map(links.map((link) => [String(link.doctor), link]));
    const selectedDoctor = doctors.find((doc) => linkByDoctorId.has(String(doc._id)));

    if (!selectedDoctor) {
      return res.status(404).json({ message: 'No hired doctor found for this specialty in selected hospital' });
    }

    const selectedLink = linkByDoctorId.get(String(selectedDoctor._id));
    const { slot, error: availabilityError } = getDoctorAvailabilityForDate(selectedLink, queueDate);
    if (availabilityError) {
      return res.status(400).json({ message: availabilityError });
    }
    const fullDoctor = await Doctor.findById(selectedDoctor._id);

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor: fullDoctor,
      hospitalId: hospital._id,
      maxDailyBookings: slot.maxDailyBookings,
      queueDate,
      reason,
      notes,
    });

    if (bookingError) {
      return res.status(bookingError.status).json({ message: bookingError.message });
    }

    res.status(201).json({
      message: 'Appointment booked by specialty successfully',
      appointment,
      assignedDoctorId: fullDoctor._id,
      assignedDoctorSpecialty: fullDoctor.specialty,
      queueNumber: appointment.queueNumber,
      queueDate: appointment.queueDate,
      scheduledAt: appointment.scheduledAt,
      slotMinutes: APPOINTMENT_SLOT_MINUTES,
      maxDailyBookings: slot.maxDailyBookings,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Queue conflict occurred. Please retry booking.' });
    }
    res.status(500).json({ message: err.message });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    let filter;

    if (req.user.role === 'patient') {
      filter = { patientUser: req.user.id };
    } else if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }
      filter = { doctor: doctor._id };
    } else {
      const hospitals = await Hospital.find({ adminUser: req.user.id }).select('_id');
      filter = { hospitalId: { $in: hospitals.map((h) => h._id) } };
    }

    const appointments = await Appointment.find(filter)
      .populate('patientUser', 'name email phone')
      .populate('hospitalId', 'name address phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } })
      .sort({ scheduledAt: 1 });

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['confirmed', 'completed', 'cancelled', 'no_show'];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status update value' });
    }

    const appointment = await Appointment.findById(req.params.id).populate('doctor');
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }

      if (String(appointment.doctor._id) !== String(doctor._id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    appointment.status = status;
    await appointment.save();

    res.json({ message: 'Appointment status updated', appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  bookAppointment,
  bookFromHospital,
  bookBySpecialty,
  getMyAppointments,
  updateAppointmentStatus,
};
