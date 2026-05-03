const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const User = require('../models/User');
const DoctorHospital = require('../models/DoctorHospital');
const bcrypt = require('bcryptjs');

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDoctorUserByIdentifier = async ({ doctorUserId, doctorEmail, email }) => {
  if (doctorUserId) {
    return User.findById(doctorUserId);
  }

  const requestedEmail = doctorEmail || email;
  if (!requestedEmail) {
    return null;
  }

  return User.findOne({ email: requestedEmail.trim().toLowerCase() });
};

const getHospitalAndAuthorize = async (hospitalId, user) => {
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return { error: { status: 404, message: 'Hospital not found' } };
  }

  if (user.role === 'hospital' && String(hospital.adminUser) !== String(user.id)) {
    return { error: { status: 403, message: 'Access denied for this hospital' } };
  }

  return { hospital };
};

const upsertDoctorHospitalLink = async ({ doctorId, hospitalId, maxDailyBookings }) => {
  const existing = await DoctorHospital.findOne({ doctor: doctorId, hospital: hospitalId });

  if (existing) {
    existing.isActive = true;
    if (typeof maxDailyBookings !== 'undefined') {
      existing.maxDailyBookings = maxDailyBookings;
    }
    await existing.save();
    return existing;
  }

  return DoctorHospital.create({
    doctor: doctorId,
    hospital: hospitalId,
    maxDailyBookings: typeof maxDailyBookings === 'undefined' ? 10 : maxDailyBookings,
    isActive: true,
  });
};

const createHospital = async (req, res) => {
  try {
    const { name, address, phone, email, hospitalAdminUserId } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Hospital name is required' });
    }

    const existing = await Hospital.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Hospital already exists' });
    }

    let adminUserId;
    if (req.user.role === 'hospital') {
      adminUserId = req.user.id;
    } else if (hospitalAdminUserId) {
      const hospitalAdmin = await User.findById(hospitalAdminUserId);
      if (!hospitalAdmin || hospitalAdmin.role !== 'hospital') {
        return res.status(400).json({ message: 'hospitalAdminUserId must be a valid hospital-role user' });
      }
      adminUserId = hospitalAdmin._id;
    }

    const hospital = await Hospital.create({
      name: name.trim(),
      address,
      phone,
      email,
      adminUser: adminUserId,
    });

    res.status(201).json({ message: 'Hospital created successfully', hospital });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHospitals = async (_req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
    res.json({ hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMyHospitals = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? { isActive: true } : { adminUser: req.user.id, isActive: true };
    const hospitals = await Hospital.find(filter).sort({ name: 1 });
    res.json({ hospitals });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const searchDoctorCandidates = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const hospitalId = req.query.hospitalId;
    const userFilter = { role: 'doctor' };

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      userFilter.$or = [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }];
    }

    if (hospitalId) {
      const { error } = await getHospitalAndAuthorize(hospitalId, req.user);
      if (error) {
        return res.status(error.status).json({ message: error.message });
      }
    }

    const users = await User.find(userFilter)
      .select('name email phone isVerified')
      .sort({ name: 1, email: 1 })
      .limit(50);

    const userIds = users.map((user) => user._id);
    const profiles = await Doctor.find({ user: { $in: userIds } });
    const profileByUserId = new Map(profiles.map((profile) => [String(profile.user), profile]));

    let linkedDoctorIds = new Set();
    if (hospitalId && profiles.length > 0) {
      const links = await DoctorHospital.find({
        hospital: hospitalId,
        doctor: { $in: profiles.map((profile) => profile._id) },
        isActive: true,
      }).select('doctor');

      linkedDoctorIds = new Set(links.map((link) => String(link.doctor)));
    }

    const doctors = users.map((user) => {
      const profile = profileByUserId.get(String(user._id));

      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          isVerified: user.isVerified,
        },
        profile: profile
          ? {
              id: profile._id,
              specialty: profile.specialty,
              licenseNumber: profile.licenseNumber,
              experienceYears: profile.experienceYears,
              consultationFee: profile.consultationFee,
              maxDailyBookings: profile.maxDailyBookings,
              bio: profile.bio,
              isApproved: profile.isApproved,
            }
          : null,
        isLinked: profile ? linkedDoctorIds.has(String(profile._id)) : false,
      };
    });

    res.json({ doctors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHospitalDoctors = async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(404).json({ message: 'Hospital not found' });
    }

    const specialtyRegex = req.query.specialty
      ? new RegExp(`^${escapeRegex(req.query.specialty.trim())}$`, 'i')
      : null;

    const links = await DoctorHospital.find({ hospital: hospital._id, isActive: true })
      .populate({
        path: 'doctor',
        match: specialtyRegex ? { isApproved: true, specialty: specialtyRegex } : { isApproved: true },
        populate: { path: 'user', select: 'name email phone' },
      })
      .sort({ createdAt: -1 });

    const doctors = links
      .filter((link) => !!link.doctor)
      .map((link) => ({
        ...link.doctor.toObject(),
        maxDailyBookings: link.maxDailyBookings,
        doctorHospitalLinkId: link._id,
      }))
      .sort((a, b) => {
        if (a.specialty !== b.specialty) {
          return String(a.specialty).localeCompare(String(b.specialty));
        }
        return (b.experienceYears || 0) - (a.experienceYears || 0);
      });

    res.json({ hospital, doctors });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const assignDoctorToHospital = async (req, res) => {
  try {
    const { hospitalId, doctorId } = req.params;
    const { specialty, maxDailyBookings } = req.body;

    const { hospital, error } = await getHospitalAndAuthorize(hospitalId, req.user);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const doctor = await Doctor.findById(doctorId).populate('user', 'name email phone');
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    if (typeof specialty !== 'undefined') {
      doctor.specialty = specialty;
      await doctor.save();
    }

    const link = await upsertDoctorHospitalLink({
      doctorId: doctor._id,
      hospitalId: hospital._id,
      maxDailyBookings,
    });

    res.json({
      message: 'Doctor assigned to hospital successfully',
      doctor,
      hospital,
      maxDailyBookings: link.maxDailyBookings,
      linkId: link._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addDoctorToHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const {
      doctorUserId,
      doctorEmail,
      email,
      specialty,
      licenseNumber,
      experienceYears,
      bio,
      consultationFee,
      availability,
      maxDailyBookings,
    } = req.body;

    const { hospital, error } = await getHospitalAndAuthorize(hospitalId, req.user);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (!doctorUserId && !doctorEmail && !email) {
      return res.status(400).json({ message: 'doctorEmail is required' });
    }

    const user = await getDoctorUserByIdentifier({ doctorUserId, doctorEmail, email });
    if (!user || user.role !== 'doctor') {
      return res.status(400).json({ message: 'Valid doctor email is required' });
    }

    let doctor = await Doctor.findOne({ user: user._id });

    if (!doctor) {
      if (!specialty || !licenseNumber) {
        return res.status(400).json({ message: 'specialty and licenseNumber are required when doctor profile does not exist' });
      }

      const existingLicense = await Doctor.findOne({ licenseNumber });
      if (existingLicense) {
        return res.status(400).json({ message: 'Doctor already exists with this licenseNumber' });
      }

      doctor = await Doctor.create({
        user: user._id,
        specialty,
        licenseNumber,
        experienceYears,
        bio,
        consultationFee,
        availability,
        isApproved: true,
      });
    } else {
      if (typeof specialty !== 'undefined') doctor.specialty = specialty;
      if (typeof experienceYears !== 'undefined') doctor.experienceYears = experienceYears;
      if (typeof bio !== 'undefined') doctor.bio = bio;
      if (typeof consultationFee !== 'undefined') doctor.consultationFee = consultationFee;
      if (typeof availability !== 'undefined') doctor.availability = availability;
      doctor.isApproved = true;
      await doctor.save();
    }

    const link = await upsertDoctorHospitalLink({
      doctorId: doctor._id,
      hospitalId: hospital._id,
      maxDailyBookings,
    });

    const populatedDoctor = await Doctor.findById(doctor._id).populate('user', 'name email phone');

    res.status(201).json({
      message: 'Doctor linked to hospital successfully',
      doctor: populatedDoctor,
      hospital,
      maxDailyBookings: link.maxDailyBookings,
      linkId: link._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const hireDoctor = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const {
      name,
      email,
      password,
      phone,
      specialty,
      licenseNumber,
      experienceYears,
      bio,
      consultationFee,
      availability,
      maxDailyBookings,
    } = req.body;

    const { hospital, error } = await getHospitalAndAuthorize(hospitalId, req.user);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    if (!email) {
      return res.status(400).json({ message: 'email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      if (!name || !password || !specialty || !licenseNumber) {
        return res.status(400).json({ message: 'For new doctor user, name, password, specialty and licenseNumber are required' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: 'doctor',
        phone,
        isVerified: true,
      });
    } else if (user.role !== 'doctor') {
      return res.status(400).json({ message: 'Existing user is not a doctor role' });
    }

    let doctor = await Doctor.findOne({ user: user._id });

    if (!doctor) {
      if (!specialty || !licenseNumber) {
        return res.status(400).json({ message: 'specialty and licenseNumber are required to create doctor profile' });
      }

      const existingLicense = await Doctor.findOne({ licenseNumber });
      if (existingLicense) {
        return res.status(400).json({ message: 'Doctor already exists with this licenseNumber' });
      }

      doctor = await Doctor.create({
        user: user._id,
        specialty,
        licenseNumber,
        experienceYears,
        bio,
        consultationFee,
        availability,
        isApproved: true,
      });
    } else {
      if (typeof specialty !== 'undefined') doctor.specialty = specialty;
      if (typeof experienceYears !== 'undefined') doctor.experienceYears = experienceYears;
      if (typeof bio !== 'undefined') doctor.bio = bio;
      if (typeof consultationFee !== 'undefined') doctor.consultationFee = consultationFee;
      if (typeof availability !== 'undefined') doctor.availability = availability;
      doctor.isApproved = true;
      await doctor.save();
    }

    const link = await upsertDoctorHospitalLink({
      doctorId: doctor._id,
      hospitalId: hospital._id,
      maxDailyBookings,
    });

    const populatedDoctor = await Doctor.findById(doctor._id).populate('user', 'name email phone');

    res.status(201).json({
      message: 'Doctor hired and linked to hospital successfully',
      hospital,
      doctor: populatedDoctor,
      maxDailyBookings: link.maxDailyBookings,
      linkId: link._id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createHospital,
  getHospitals,
  getMyHospitals,
  searchDoctorCandidates,
  getHospitalDoctors,
  assignDoctorToHospital,
  addDoctorToHospital,
  hireDoctor,
};
