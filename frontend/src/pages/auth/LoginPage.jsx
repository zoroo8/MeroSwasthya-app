import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      login({ token: data.token, user: data.user });
      navigate('/app');
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
          <span>Welcome Back !</span>
          <h2>Login</h2>
          <p>Sign in as a patient, doctor, or care team member.</p>
        </div>
        <div className="auth-role-strip" aria-label="Supported account types">
          <span>Patient</span>
          <span>Doctor</span>
        </div>
        <div className="form-grid">
          <label className="input-group">
            <span>Email</span>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label className="input-group">
            <span>Password</span>
            <input type="password" placeholder="Your password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </label>
        </div>
        <button className="primary-action" type="submit">Login</button>
        {error && <p className="error">{error}</p>}
        <div className="auth-links">
          <Link to="/verify-otp">Verify account</Link>
          <Link to="/register">Sign up ?</Link>
        </div>
      </form>
    </div>
  );
}
