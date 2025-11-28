import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../../api/client';

export function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'patient' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const data = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage(data.message || 'Registered');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="mobile-brand">
          <span className="mobile-brand-mark">MS</span>
          <strong>MeroSwasthya</strong>
          <small>HealthCare App</small>
        </div>
        <div className="auth-form-header">
          <span>SignUp</span>
          <h2>Create account</h2>
          <p>Set up your patient or doctor workspace.</p>
        </div>
        <div className="auth-role-strip auth-role-strip-select" aria-label="Choose account type">
          <button
            type="button"
            className={form.role === 'patient' ? 'active' : ''}
            onClick={() => setForm((p) => ({ ...p, role: 'patient' }))}
          >
            Patient
          </button>
          <button
            type="button"
            className={form.role === 'doctor' ? 'active' : ''}
            onClick={() => setForm((p) => ({ ...p, role: 'doctor' }))}
          >
            Doctor
          </button>
        </div>
        <div className="form-grid">
          <label className="input-group">
            <span>Name</span>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <label className="input-group">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label className="input-group">
            <span>Password</span>
            <input type="password" placeholder="Minimum 6 characters" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </label>
          <label className="input-group desktop-role-field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </label>
        </div>
        <button className="primary-action" type="submit">Register</button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
        <div className="auth-links">
          <Link to="/login">I have an account</Link>
          <Link to="/verify-otp">Verify OTP</Link>
        </div>
      </form>
    </div>
  );
}
