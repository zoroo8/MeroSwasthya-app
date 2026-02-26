import nodemailer from 'nodemailer';

export const isEmailServiceConfigured = () => {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
};

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const getSubjectByPurpose = (purpose) => {
  if (purpose === 'reset') {
    return 'MeroSwasthya Password Reset OTP';
  }

  return 'MeroSwasthya Account Verification OTP';
};

const getMessageByPurpose = (purpose, otp, name) => {
  if (purpose === 'reset') {
    return {
      text: `Hello ${name || 'User'}, your password reset OTP is ${otp}. It expires in 10 minutes.`,
      html: `<p>Hello ${name || 'User'},</p><p>Your password reset OTP is <b>${otp}</b>.</p><p>This OTP expires in 10 minutes.</p>`,
    };
  }

  return {
    text: `Hello ${name || 'User'}, your account verification OTP is ${otp}. It expires in 10 minutes.`,
    html: `<p>Hello ${name || 'User'},</p><p>Your account verification OTP is <b>${otp}</b>.</p><p>This OTP expires in 10 minutes.</p>`,
  };
};

export const sendOtpEmail = async ({ to, otp, purpose = 'verification', name }) => {
  if (!isEmailServiceConfigured()) {
    throw new Error('Email service is not configured');
  }

  const transporter = createTransporter();
  const subject = getSubjectByPurpose(purpose);
  const message = getMessageByPurpose(purpose, otp, name);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text: message.text,
    html: message.html,
  });
};
