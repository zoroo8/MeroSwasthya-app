const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const PatientProfile = require('../models/PatientProfile');

const router = express.Router();

router.get('/me', auth, role('patient'), async (req, res) => {
  try {
    const profile = await PatientProfile.findOne({ user: req.user.id }).populate('user', 'name email phone');

    if (!profile) {
      return res.status(404).json({ message: 'Patient profile not found' });
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/me', auth, role('patient'), async (req, res) => {
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

    const profile = await PatientProfile.findOneAndUpdate(
      { user: req.user.id },
      payload,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('user', 'name email phone');

    res.json({ message: 'Patient profile saved successfully', profile });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;