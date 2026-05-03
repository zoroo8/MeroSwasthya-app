const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const DoctorHospital = require('../models/DoctorHospital');

const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getQueueDate = (scheduledAt) => {
  return new Date(scheduledAt).toISOString().slice(0, 10);
};

const validateAppointmentInput = ({ scheduledAt, reason }) => {
  if (!scheduledAt || !reason) {
    return 'scheduledAt and reason are required';
  }

  const appointmentDate = new Date(scheduledAt);
  if (Number.isNaN(appointmentDate.getTime())) {
    return 'Invalid scheduledAt date';
  }

  if (appointmentDate.getTime() <= Date.now()) {
    return 'Appointment must be scheduled in the future';
  }

  return null;
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
  const filter = {
    doctor: doctorId,
    queueDate,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  };

  if (hospitalId) {
    filter.hospitalId = hospitalId;
  }

  const [activeCount, latestAppointment] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.findOne({ doctor: doctorId, queueDate, hospitalId: hospitalId || { $exists: false } })
      .sort({ queueNumber: -1 })
      .select('queueNumber'),
  ]);

  return {
    activeCount,
    nextQueueNumber: (latestAppointment?.queueNumber || 0) + 1,
  };
};

const createAppointmentWithQueue = async ({ patientUserId, doctor, hospitalId, maxDailyBookings, scheduledAt, reason, notes }) => {
  const queueDate = getQueueDate(scheduledAt);
  const { activeCount, nextQueueNumber } = await getBookingSnapshot({
    doctorId: doctor._id,
    hospitalId,
    queueDate,
  });

  if (activeCount >= maxDailyBookings) {
    return {
      error: {
        status: 400,
        message: `Booking limit reached for this doctor. Max daily booking is ${maxDailyBookings}`,
      },
    };
  }

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
    const { doctorId, scheduledAt, reason, notes } = req.body;
    const validationError = validateAppointmentInput({ scheduledAt, reason });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }
    if (!doctorId) {
      return res.status(400).json({ message: 'doctorId is required' });
    }

    const appointmentDate = new Date(scheduledAt);
    const { doctor, error } = await getDoctorOrError(doctorId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor,
      hospitalId: null,
      maxDailyBookings: doctor.maxDailyBookings,
      scheduledAt: appointmentDate,
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
    const { hospitalId, doctorId, scheduledAt, reason, notes } = req.body;

    if (!hospitalId) {
      return res.status(400).json({ message: 'hospitalId is required' });
    }

    const validationError = validateAppointmentInput({ scheduledAt, reason });
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

    const appointmentDate = new Date(scheduledAt);
    const { doctor, error } = await getDoctorOrError(doctorId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const link = await getHospitalDoctorLink({ doctorId: doctor._id, hospitalId: hospital._id });
    if (!link) {
      return res.status(400).json({ message: 'Selected doctor is not hired by this hospital' });
    }

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor,
      hospitalId: hospital._id,
      maxDailyBookings: link.maxDailyBookings,
      scheduledAt: appointmentDate,
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
      maxDailyBookings: link.maxDailyBookings,
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
    const { hospitalId, specialty, scheduledAt, reason, notes } = req.body;

    if (!hospitalId || !specialty) {
      return res.status(400).json({ message: 'hospitalId and specialty are required' });
    }

    const validationError = validateAppointmentInput({ scheduledAt, reason });
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
    const fullDoctor = await Doctor.findById(selectedDoctor._id);

    const { appointment, error: bookingError } = await createAppointmentWithQueue({
      patientUserId: req.user.id,
      doctor: fullDoctor,
      hospitalId: hospital._id,
      maxDailyBookings: selectedLink.maxDailyBookings,
      scheduledAt: new Date(scheduledAt),
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
      maxDailyBookings: selectedLink.maxDailyBookings,
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
