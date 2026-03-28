const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');

const buildAppointmentPayload = ({ patientUserId, doctor, scheduledAt, reason, notes }) => {
  return {
    patientUser: patientUserId,
    doctor: doctor._id,
    hospitalId: doctor.hospitalId || undefined,
    scheduledAt,
    reason: reason.trim(),
    notes,
  };
};

const validateAppointmentInput = ({ doctorId, scheduledAt, reason }) => {
  if (!doctorId || !scheduledAt || !reason) {
    return 'doctorId, scheduledAt and reason are required';
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

const bookAppointment = async (req, res) => {
  try {
    const { doctorId, scheduledAt, reason, notes } = req.body;
    const validationError = validateAppointmentInput({ doctorId, scheduledAt, reason });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const appointmentDate = new Date(scheduledAt);
    const { doctor, error } = await getDoctorOrError(doctorId);

    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const appointment = await Appointment.create(
      buildAppointmentPayload({
        patientUserId: req.user.id,
        doctor,
        scheduledAt: appointmentDate,
        reason,
        notes,
      })
    );

    res.status(201).json({ message: 'Appointment booked successfully', appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bookFromHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId, scheduledAt, reason, notes } = req.body;

    if (!hospitalId) {
      return res.status(400).json({ message: 'hospitalId is required' });
    }

    const validationError = validateAppointmentInput({ doctorId, scheduledAt, reason });
    if (validationError) {
      return res.status(400).json({ message: validationError });
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

    if (!doctor.hospitalId || String(doctor.hospitalId) !== String(hospital._id)) {
      return res.status(400).json({ message: 'Selected doctor does not belong to this hospital' });
    }

    const appointment = await Appointment.create(
      buildAppointmentPayload({
        patientUserId: req.user.id,
        doctor,
        scheduledAt: appointmentDate,
        reason,
        notes,
      })
    );

    res.status(201).json({ message: 'Hospital doctor appointed successfully', appointment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyAppointments = async (req, res) => {
  try {
    let filter;

    if (req.user.role === 'patient') {
      filter = { patientUser: req.user.id };
    } else {
      const doctor = await Doctor.findOne({ user: req.user.id });
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }
      filter = { doctor: doctor._id };
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
  getMyAppointments,
  updateAppointmentStatus,
};