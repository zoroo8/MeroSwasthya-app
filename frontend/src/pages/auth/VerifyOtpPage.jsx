import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export function VerifyOtpPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', otp: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const payload = {
        email: form.email.trim().toLowerCase(),
        otp: form.otp.trim(),
      };
      const data = await apiRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.token && data.user) {
        login({ token: data.token, user: data.user });
        navigate('/app');
        return;
      }
      setMessage(data.message || 'Verified');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      });
      setMessage(data.message || 'OTP resent');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const otpDigits = Array.from({ length: 6 }, (_, index) => form.otp[index] || '');

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="mobile-brand">
          <span className="mobile-brand-mark">MS</span>
          <strong>MeroSwasthya</strong>
          <small>HealthCare App</small>
        </div>
        <div className="auth-form-header">
          <span>Verification</span>
          <h2>Enter your Verification code</h2>
          <p>We sent a verification code to your email.</p>
        </div>
        <div className="form-grid">
          <label className="input-group">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label className="input-group otp-field">
            <span>OTP</span>
            <input
              placeholder="6 digit code"
              value={form.otp}
              maxLength={6}
              onChange={(e) => setForm((p) => ({ ...p, otp: e.target.value.replace(/\D/g, '') }))}
            />
            <div className="otp-cells" aria-hidden="true">
              {otpDigits.map((digit, index) => (
                <span key={index}>{digit}</span>
              ))}
            </div>
          </label>
        </div>
        <div className="button-row">
          <button className="primary-action" type="submit" disabled={loading}>{loading ? 'Please wait...' : 'Verify'}</button>
          <button className="secondary-action" type="button" onClick={resendOtp} disabled={loading || !form.email.trim()}>
            Resend OTP
          </button>
        </div>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="auth-links">
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
        </div>
      </form>
    </div>
  );
}
