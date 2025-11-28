import { useAuth } from '../../hooks/useAuth';
import { AdminDashboard } from './AdminDashboard';
import { DoctorDashboard } from './DoctorDashboard';
import { HospitalDashboard } from './HospitalDashboard';
import { PatientDashboard } from './PatientDashboard';

const dashboardMeta = {
  admin: {
    eyebrow: 'Admin',
    title: 'Manage the system',
    summary: 'Use the tabs below to add users, create hospitals, approve doctors, and review reports.',
  },
  doctor: {
    eyebrow: 'Doctor',
    title: 'Manage patient visits',
    summary: 'Use the tabs below to update your profile, view visits, chat, and create reports.',
  },
  hospital: {
    eyebrow: 'Hospital',
    title: 'Manage hospital work',
    summary: 'Use the tabs below to update hospital details, link doctors, view visits, and create reports.',
  },
  patient: {
    eyebrow: 'Patient',
    title: 'Manage your care',
    summary: 'Book appointments, view your visits, and keep your health records in one place.',
  },
};

export function DashboardHome() {
  const { user } = useAuth();
  const role = user?.role || 'patient';
  const meta = dashboardMeta[role] || dashboardMeta.patient;

  let Dashboard = PatientDashboard;
  if (role === 'admin') Dashboard = AdminDashboard;
  if (role === 'doctor') Dashboard = DoctorDashboard;
  if (role === 'hospital') Dashboard = HospitalDashboard;

  return (
    <div className={`dashboard-stack dashboard-${role}`}>
      <section className="dashboard-hero">
        <div>
          <p className="eyebrow">{meta.eyebrow}</p>
          <h2>{meta.title}</h2>
          <p>{meta.summary}</p>
        </div>
        <div className="role-panel">
          <span>Signed in as</span>
          <strong>{user?.name}</strong>
          <small>{role}</small>
        </div>
      </section>
      <Dashboard />
    </div>
  );
}
