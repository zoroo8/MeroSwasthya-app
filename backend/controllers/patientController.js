const PatientProfile = require('../models/PatientProfile');
const Appointment = require('../models/Appointment');
const MedicalReport = require('../models/MedicalReport');

const getMyProfile = async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ user: req.user.id }).populate('user', 'name email phone');

    if (!profile) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const upsertMyProfile = async (req, res) => {
  try {
    const {
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      allergies,
      chronicConditions,
    } = req.body;

    const payload = {
      dateOfBirth,
      gender,
      bloodGroup,
      address,
      emergencyContactName,
      emergencyContactPhone,
      allergies: Array.isArray(allergies) ? allergies : [],
      chronicConditions: Array.isArray(chronicConditions) ? chronicConditions : [],
    };

    const profile = await PatientProfile.findOneAndUpdate({ user: req.user.id }, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }).populate('user', 'name email phone');

    res.json({ message: 'Patient profile saved successfully', profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyPastAppointmentsWithReports = async (req, res) => {
  try {
    const now = new Date();
    const pastStatuses = ['completed', 'cancelled', 'no_show'];

    const appointments = await Appointment.find({
      patientUser: req.user.id,
      $or: [{ scheduledAt: { $lt: now } }, { status: { $in: pastStatuses } }],
    })
      .populate('hospitalId', 'name address phone')
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } })
      .sort({ scheduledAt: -1 });

    const appointmentIds = appointments.map((appointment) => appointment._id);
    const reports = await MedicalReport.find({
      patientUser: req.user.id,
      appointment: { $in: appointmentIds },
    }).populate('appointment', '_id');

    const reportByAppointmentId = new Map(
      reports.map((report) => [String(report.appointment._id), report])
    );

    const history = appointments.map((appointment) => {
      const report = reportByAppointmentId.get(String(appointment._id)) || null;

      return {
        appointmentId: appointment._id,
        date: appointment.scheduledAt,
        status: appointment.status,
        queueNumber: appointment.queueNumber,
        hospital: appointment.hospitalId
          ? {
              id: appointment.hospitalId._id,
              name: appointment.hospitalId.name,
              address: appointment.hospitalId.address,
              phone: appointment.hospitalId.phone,
            }
          : null,
        doctor: appointment.doctor
          ? {
              id: appointment.doctor._id,
              specialty: appointment.doctor.specialty,
              consultationFee: appointment.doctor.consultationFee,
              name: appointment.doctor.user?.name,
              email: appointment.doctor.user?.email,
              phone: appointment.doctor.user?.phone,
            }
          : null,
        report: report
          ? {
              id: report._id,
              diagnosis: report.diagnosis,
              prescription: report.prescription,
              testRecommendations: report.testRecommendations,
              followUpDate: report.followUpDate,
              notes: report.notes,
              attachments: report.attachments,
              createdAt: report.createdAt,
            }
          : null,
      };
    });

    res.json({ history });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMyProfile,
  upsertMyProfile,
  getMyPastAppointmentsWithReports,
};
