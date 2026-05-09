const fs = require('fs');
const path = require('path');
const multer = require('multer');

const profileImageDir = path.join(__dirname, '..', 'uploads', 'profile-images');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

fs.mkdirSync(profileImageDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profileImageDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeUserId = String(req.user?.id || 'user').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeUserId}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    return;
  }

  cb(null, true);
};

const profileImageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

const runProfileImageUpload = (req, res, next) => {
  profileImageUpload.single('profileImage')(req, res, (err) => {
    if (!err) {
      next();
      return;
    }

    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Profile image must be 2MB or smaller'
      : err.message || 'Profile image upload failed';

    res.status(400).json({ message });
  });
};

module.exports = {
  profileImageDir,
  runProfileImageUpload,
};
