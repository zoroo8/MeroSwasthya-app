import { useEffect, useState } from 'react';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import {
  EmptyState,
  Field,
  Notice,
  SectionCard,
  TabNav,
  formatDateTime,
} from '../../components/common/DashboardComponents';

const initialUser = {
  name: '',
  email: '',
  password: '',
  role: 'doctor',
  phone: '',
  profileImage: '',
  isVerified: true,
};

const initialHospital = {
  name: '',
  address: '',
  phone: '',
  email: '',
  bannerImage: '',
  hospitalAdminUserId: '',
};

const tabs = [
  { id: 'overview', label: 'Home', icon: 'home' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'hospitals', label: 'Hospitals', icon: 'hospital' },
  { id: 'approvals', label: 'Approvals', icon: 'check' },
  { id: 'reports', label: 'Reports', icon: 'report' },
];

export function AdminDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [userForm, setUserForm] = useState(initialUser);
  const [hospitalForm, setHospitalForm] = useState(initialHospital);
  const [stats, setStats] = useState({ totalUsers: 0, patients: 0, doctors: 0, hospitals: 0 });
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [reports, setReports] = useState([]);
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  const setField = (setter) => (event) => {
    const { name, value, type, checked } = event.target;
    setter((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const run = async (task, successMessage) => {
    setStatus({ loading: true, error: '', message: '' });
    try {
      const data = await task();
      setStatus({ loading: false, error: '', message: successMessage || '' });
      return data;
    } catch (err) {
      setStatus({ loading: false, error: err.message || 'Request failed', message: '' });
      return null;
    }
  };

  const loadOverview = async () => {
    setStatus((current) => ({ ...current, loading: true, error: '' }));

    const [statsResult, pendingResult, reportResult] = await Promise.allSettled([
      apiRequest('/admin/stats', { method: 'GET' }, token),
      apiRequest('/doctor/pending-approvals', { method: 'GET' }, token),
      apiRequest('/report/my', { method: 'GET' }, token),
    ]);

    if (statsResult.status === 'fulfilled') {
      setStats(statsResult.value.stats || {});
    }

    if (pendingResult.status === 'fulfilled') {
      setPendingDoctors(pendingResult.value.doctors || []);
    }

    if (reportResult.status === 'fulfilled') {
      setReports(reportResult.value.reports || []);
    }

    setStatus((current) => ({ ...current, loading: false }));
  };

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token]);

  const createUser = async (event) => {
    event.preventDefault();
    const data = await run(
      () => apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(userForm) }, token),
      'User created'
    );

    if (data) {
      setUserForm(initialUser);
      loadOverview();
    }
  };

  const createHospital = async (event) => {
    event.preventDefault();
    const data = await run(
      () => apiRequest('/admin/hospitals', { method: 'POST', body: JSON.stringify(hospitalForm) }, token),
      'Hospital created'
    );

    if (data) {
      setHospitalForm(initialHospital);
      loadOverview();
    }
  };

  const approveDoctor = async (doctorId) => {
    const data = await run(
      () => apiRequest(`/doctor/${doctorId}/approve`, { method: 'PATCH', body: JSON.stringify({}) }, token),
      'Doctor approved'
    );

    if (data) loadOverview();
  };

  return (
    <div className="workspace-grid">
      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="role-overview-grid admin-overview-grid">
          <section className="role-feature-panel admin-feature-panel">
            <div>
              <span>Next step</span>
              <h3>Review system activity</h3>
              <p>Check pending doctor approvals first, then add users or hospitals when needed.</p>
            </div>
            <button className="role-feature-button" type="button" onClick={loadOverview} disabled={status.loading}>
              Refresh Data
            </button>
          </section>

          <div className="role-metric-grid admin-metric-grid">
            <article className="role-metric-card">
              <span>Total Users</span>
              <strong>{stats.totalUsers || 0}</strong>
              <small>Accounts</small>
            </article>
            <article className="role-metric-card">
              <span>Patients</span>
              <strong>{stats.patients || 0}</strong>
              <small>Care users</small>
            </article>
            <article className="role-metric-card">
              <span>Doctors</span>
              <strong>{stats.doctors || 0}</strong>
              <small>Clinicians</small>
            </article>
            <article className="role-metric-card">
              <span>Hospitals</span>
              <strong>{stats.hospitals || 0}</strong>
              <small>Facilities</small>
            </article>
          </div>

          <section className="role-action-panel">
            <div className="role-panel-heading">
              <span>Doctor Approvals</span>
              <button type="button" onClick={() => setActiveTab('approvals')}>Review</button>
            </div>
            {pendingDoctors.length === 0 ? (
              <EmptyState title="No pending doctors" />
            ) : (
              pendingDoctors.slice(0, 3).map((doctor) => (
                <article key={doctor._id} className="role-list-item">
                  <div className="avatar avatar-mini">{(doctor.user?.name || 'D')[0]}</div>
                  <div>
                    <strong>{doctor.user?.name || 'Doctor'}</strong>
                    <small>{doctor.specialty} - {doctor.experienceYears || 0} years</small>
                  </div>
                  <button
                    className="primary-action compact-button"
                    type="button"
                    onClick={() => approveDoctor(doctor._id)}
                    disabled={status.loading}
                  >
                    Approve
                  </button>
                </article>
              ))
            )}
          </section>

          <section className="role-action-panel">
            <div className="role-panel-heading">
              <span>Recent Reports</span>
              <button type="button" onClick={() => setActiveTab('reports')}>View all</button>
            </div>
            {reports.length === 0 ? (
              <EmptyState title="No reports yet" />
            ) : (
              reports.slice(0, 3).map((report) => (
                <article key={report._id} className="role-list-item">
                  <div className="avatar avatar-mini">{(report.patientUser?.name || 'P')[0]}</div>
                  <div>
                    <strong>{report.patientUser?.name || 'Patient'} - {report.diagnosis}</strong>
                    <small>{report.doctor?.user?.name || 'Doctor'} - {formatDateTime(report.createdAt)}</small>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      )}

      {activeTab === 'users' && (
      <SectionCard title="Create User" description="Add doctors, hospital admins, admins, or patients.">
        <form className="form-grid two-column" onSubmit={createUser}>
          <Field label="Name">
            <input name="name" value={userForm.name} onChange={setField(setUserForm)} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" value={userForm.email} onChange={setField(setUserForm)} />
          </Field>
          <Field label="Password">
            <input name="password" type="password" value={userForm.password} onChange={setField(setUserForm)} />
          </Field>
          <Field label="Role">
            <select name="role" value={userForm.role} onChange={setField(setUserForm)}>
              <option value="doctor">Doctor</option>
              <option value="hospital">Hospital Admin</option>
              <option value="patient">Patient</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
          <Field label="Phone">
            <input name="phone" value={userForm.phone} onChange={setField(setUserForm)} />
          </Field>
          <Field label="Profile Image URL">
            <input name="profileImage" value={userForm.profileImage} onChange={setField(setUserForm)} placeholder="https://..." />
          </Field>
          <label className="check-row">
            <input name="isVerified" type="checkbox" checked={userForm.isVerified} onChange={setField(setUserForm)} />
            <span>Mark as verified</span>
          </label>
          <div className="form-footer">
            <button className="primary-action" disabled={status.loading}>Create User</button>
          </div>
        </form>
      </SectionCard>
      )}

      {activeTab === 'hospitals' && (
      <SectionCard title="Create Hospital" description="Create a hospital and link it to a hospital admin user.">
        <form className="form-grid two-column" onSubmit={createHospital}>
          <Field label="Hospital Name">
            <input name="name" value={hospitalForm.name} onChange={setField(setHospitalForm)} />
          </Field>
          <Field label="Hospital Admin User ID">
            <input name="hospitalAdminUserId" value={hospitalForm.hospitalAdminUserId} onChange={setField(setHospitalForm)} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" value={hospitalForm.email} onChange={setField(setHospitalForm)} />
          </Field>
          <Field label="Phone">
            <input name="phone" value={hospitalForm.phone} onChange={setField(setHospitalForm)} />
          </Field>
          <Field label="Address">
            <input name="address" value={hospitalForm.address} onChange={setField(setHospitalForm)} />
          </Field>
          <Field label="Banner Image URL">
            <input name="bannerImage" value={hospitalForm.bannerImage} onChange={setField(setHospitalForm)} placeholder="https://..." />
          </Field>
          <div className="form-footer">
            <button className="primary-action" disabled={status.loading}>Create Hospital</button>
          </div>
        </form>
      </SectionCard>
      )}

      {activeTab === 'approvals' && (
      <SectionCard
        title="Doctor Approvals"
        description="Approve valid doctor profiles before they can receive bookings."
        actions={<button className="secondary-action" type="button" onClick={loadOverview} disabled={status.loading}>Refresh</button>}
      >
        <div className="list-stack">
          {pendingDoctors.length === 0 ? (
            <EmptyState title="No pending doctors" />
          ) : (
            pendingDoctors.map((doctor) => (
              <article key={doctor._id} className="appointment-card appointment-card-expanded">
                <div>
                  <strong>{doctor.user?.name || 'Doctor'}</strong>
                  <p>{doctor.specialty} - License {doctor.licenseNumber}</p>
                  <small>{doctor.user?.email || 'No email'} - {doctor.experienceYears || 0} years experience</small>
                </div>
                <button className="primary-action compact-button" type="button" onClick={() => approveDoctor(doctor._id)} disabled={status.loading}>
                  Approve
                </button>
              </article>
            ))
          )}
        </div>
      </SectionCard>
      )}

      {activeTab === 'reports' && (
      <SectionCard title="System Reports" description="Review all medical reports in the system.">
        <div className="list-stack">
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" />
          ) : (
            reports.map((report) => (
              <article key={report._id} className="compact-item">
                <strong>{report.patientUser?.name || 'Patient'} - {report.diagnosis}</strong>
                <span>{report.doctor?.user?.name || 'Doctor'} - {report.hospitalId?.name || 'No hospital'}</span>
                <small>{formatDateTime(report.createdAt)}</small>
              </article>
            ))
          )}
        </div>
      </SectionCard>
      )}

      <Notice error={status.error} message={status.message} />
    </div>
  );
}
