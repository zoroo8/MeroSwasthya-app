const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');

const parseTime = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
};

const formatTime = (dateObj) => {
  return dateObj.toTimeString().substring(0, 5);
};

const addMinutes = (dateObj, minutes) => {
  return new Date(dateObj.getTime() + minutes * 60000);
};

class SlotManagementService {
  async getAvailableSlots(doctorId, dateString) {
    const date = new Date(dateString);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()]; // Note: Doctor 'day' field should store 'Sunday', 'Monday' etc.

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.availability) return [];

    // Filter rules based on the specific day string
    const dayAvailability = doctor.availability.filter(a => a.day === dayName || a.day.toLowerCase() === dayName.toLowerCase());
    if (!dayAvailability.length) return [];

    // Identify already booked slots on this specific date
    const bookedAppointments = await Appointment.find({
      doctor: doctorId,
      appointmentDate: dateString,
      status: { $ne: 'CANCELLED' }
    }).select('startTime -_id');

    const bookedStartTimes = new Set(bookedAppointments.map(a => a.startTime));
    const availableSlots = [];
    const slotDurationMinutes = 30; // Hardcoded to 30mins per standard

    for (const block of dayAvailability) {
      if (!block.startTime || !block.endTime) continue;
      
      let currentSlot = parseTime(block.startTime);
      const endSlot = parseTime(block.endTime);

      while (addMinutes(currentSlot, slotDurationMinutes) <= endSlot) {
        const formattedTime = formatTime(currentSlot);
        if (!bookedStartTimes.has(formattedTime)) {
          availableSlots.push({
            startTime: formattedTime,
            endTime: formatTime(addMinutes(currentSlot, slotDurationMinutes))
          });
        }
        currentSlot = addMinutes(currentSlot, slotDurationMinutes);
      }
    }

    return availableSlots;
  }

  async bookSlot(doctorId, patientId, dateString, startTimeStr, durationMinutes = 30) {
    const endTimeStr = formatTime(addMinutes(parseTime(startTimeStr), durationMinutes));

    try {
      const newAppointment = await Appointment.create({
        doctor: doctorId,
        patient: patientId,
        appointmentDate: dateString,
        startTime: startTimeStr,
        endTime: endTimeStr,
        status: 'UPCOMING'
      });
      return newAppointment;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error('Conflict: The selected time slot was just booked by someone else.');
      }
      throw error;
    }
  }
}

module.exports = new SlotManagementService();
