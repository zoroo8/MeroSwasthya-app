import User from '../models/User.js';

const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const ALLOWED_UPDATE_FIELDS = ['name', 'age', 'gender', 'phone', 'contact', 'profileImage'];
const RESTRICTED_FIELDS = [
  'email',
  'password',
  'role',
  'isVerified',
  'isActive',
  'verificationOtp',
  'verificationOtpExpiresAt',
  'resetOtp',
  'resetOtpExpiresAt',
];

const sanitizeUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    age: user.age,
    gender: user.gender,
    contact: user.phone,
    phone: user.phone,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

const normalizeUpdatePayload = (payload) => {
  const normalized = { ...payload };

  if (Object.prototype.hasOwnProperty.call(normalized, 'contact')) {
    normalized.phone = normalized.contact;
    delete normalized.contact;
  }

  return normalized;
};

const validateUpdates = (updates) => {
  const keys = Object.keys(updates);

  const restricted = keys.filter((key) => RESTRICTED_FIELDS.includes(key));
  if (restricted.length > 0) {
    return `Field(s) not allowed: ${restricted.join(', ')}`;
  }

  const invalid = keys.filter((key) => !ALLOWED_UPDATE_FIELDS.includes(key));
  if (invalid.length > 0) {
    return `Invalid field(s): ${invalid.join(', ')}`;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'name')) {
    if (typeof updates.name !== 'string' || !updates.name.trim()) {
      return 'Name must be a non-empty string';
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'age')) {
    const ageNumber = Number(updates.age);
    if (!Number.isInteger(ageNumber) || ageNumber < 0 || ageNumber > 130) {
      return 'Age must be an integer between 0 and 130';
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'gender')) {
    const gender = String(updates.gender || '').toLowerCase();
    if (!['male', 'female', 'other'].includes(gender)) {
      return 'Gender must be one of: male, female, other';
    }
    updates.gender = gender;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'phone')) {
    if (updates.phone === null || updates.phone === '') {
      updates.phone = undefined;
    } else if (typeof updates.phone !== 'string' || !PHONE_PATTERN.test(updates.phone.trim())) {
      return 'Phone must be a valid number with 7 to 15 digits';
    } else {
      updates.phone = updates.phone.trim();
    }
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'profileImage')) {
    if (updates.profileImage === null || updates.profileImage === '') {
      updates.profileImage = undefined;
    } else if (typeof updates.profileImage !== 'string') {
      return 'Profile image must be a string URL';
    }
  }

  updates.name = updates.name?.trim();

  return null;
};

export const getPatientProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    return res.json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const updatePatientProfile = async (req, res) => {
  try {
    const updates = normalizeUpdatePayload(req.body || {});
    const keys = Object.keys(updates);

    if (keys.length === 0) {
      return res.status(400).json({ message: 'No profile fields provided for update' });
    }

    const validationError = validateUpdates(updates);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: 'Account is deactivated. Contact support.' });
    }

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        user[key] = updates[key];
      }
    }

    await user.save();

    return res.json({
      message: 'Profile updated successfully',
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
