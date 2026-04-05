const slotService = require('../services/slotService');
const Appointment = require('../models/Appointment');

const getAvailableSlots = async (req, res) => {
  try {
    const { doctorId, date } = req.query; // e.g., /api/appointments/slots?doctorId=123&date=YYYY-MM-DD
    if (!doctorId || !date) {
      return res.status(400).json({ success: false, message: 'doctorId and date are required query parameters.' });
    }
    const slots = await slotService.getAvailableSlots(doctorId, date);
    res.json({ success: true, message: 'Available slots fetched successfully', data: slots });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const bookSlot = async (req, res) => {
  try {
    const { doctorId, date, startTime } = req.body;
    // Patient is technically the one booking. Grabbing from token via auth middleware.
    const patientId = req.user.id; 
    
    if (!doctorId || !date || !startTime) {
      return res.status(400).json({ success: false, message: 'doctorId, date, and startTime are required body parameters.' });
    }

    const newAppointment = await slotService.bookSlot(doctorId, patientId, date, startTime);
    res.status(201).json({ success: true, message: 'Slot booked successfully', data: newAppointment });
  } catch (err) {
    if (err.message.includes('Conflict:')) {
      return res.status(409).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const getDoctorAppointments = async (req, res) => {
  try {
    const doctorId = req.user.id; // Assuming doctor requests their own appointments
    const date = req.query.date;

    const filter = {};
    if (date) filter.appointmentDate = date;
    
    // We actually need the ObjectId of the Doctor profile linked to the User
    const Doctor = require('../models/Doctor');
    const doctorProfile = await Doctor.findOne({ user: doctorId });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found for this user.' });
    }

    filter.doctor = doctorProfile._id;

    const appointments = await Appointment.find(filter)
      .populate('patient', 'name email record')
      .sort({ startTime: 1 });
      
    res.json({ success: true, message: 'Appointments fetched', data: appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAvailableSlots,
  bookSlot,
  getDoctorAppointments
};
