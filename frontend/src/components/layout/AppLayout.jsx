import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import { apiRequest, getAssetUrl } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export function AppLayout() {
  const { user, token, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [imageStatus, setImageStatus] = useState({ loading: false, error: '' });
  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const profileImageUrl = getAssetUrl(user?.profileImage);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const uploadProfileImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profileImage', file);
    setImageStatus({ loading: true, error: '' });

    try {
      const data = await apiRequest('/auth/me/profile-image', {
        method: 'POST',
        body: formData,
      }, token);
      setUser(data.user);
      setImageStatus({ loading: false, error: '' });
    } catch (err) {
      setImageStatus({ loading: false, error: err.message || 'Image upload failed' });
    } finally {
      event.target.value = '';
    }
  };

  const deleteProfileImage = async () => {
    setImageStatus({ loading: true, error: '' });

    try {
      const data = await apiRequest('/auth/me/profile-image', { method: 'DELETE' }, token);
      setUser(data.user);
      setImageStatus({ loading: false, error: '' });
    } catch (err) {
      setImageStatus({ loading: false, error: err.message || 'Image delete failed' });
    }
  };

  return (
    <div className={`app-shell app-shell-${user?.role || 'guest'}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">M</div>
          <div>
            <h1>MeroSwasthya</h1>
            <p>Hospital Management System</p>
          </div>
        </div>
        <div className="topbar-actions">
          <nav className="topbar-nav" aria-label="Primary navigation">
            <Link to="/app">Dashboard</Link>
          </nav>
          <div className="account-cluster">
            <div className="user-chip">
              {profileImageUrl ? (
                <img className="avatar" src={profileImageUrl} alt="" />
              ) : (
                <div className="avatar">{initials}</div>
              )}
              <div className="user-meta">
                <span>{user?.name}</span>
                <small>{user?.role}</small>
              </div>
            </div>
            <div className="profile-image-actions">
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={uploadProfileImage}
              />
              <button
                className="secondary-action compact-button"
                type="button"
                disabled={imageStatus.loading}
                onClick={() => fileInputRef.current?.click()}
              >
                {user?.profileImage ? 'Edit Photo' : 'Upload Photo'}
              </button>
              {user?.profileImage && (
                <button
                  className="ghost-button compact-button"
                  type="button"
                  disabled={imageStatus.loading}
                  onClick={deleteProfileImage}
                >
                  Delete Photo
                </button>
              )}
              {imageStatus.error && <small className="topbar-error">{imageStatus.error}</small>}
            </div>
            <button className="ghost-button compact-button" onClick={onLogout}>Logout</button>
          </div>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
