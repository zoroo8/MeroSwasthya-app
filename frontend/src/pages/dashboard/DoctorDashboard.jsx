import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ChatPanel } from '../../components/common/ChatPanel';
import { ReportDraftPreview, TagListField } from '../../components/common/ReportComposer';
import {
  EmptyState,
  Field,
  Notice,
  SectionCard,
  StatusPill,
  TabNav,
  formatDateGroup,
  formatDateTime,
  getDateKey,
  groupByDate,
} from '../../components/common/DashboardComponents';

const initialProfile = {
  specialty: '',
  licenseNumber: '',
  experienceYears: 0,
  consultationFee: 0,
  maxDailyBookings: 10,
  bio: '',
};

const initialReport = {
  appointmentId: '',
  diagnosis: '',
  prescription: '',
  testRecommendations: '',
  followUpDate: '',
  notes: '',
};

const toList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getPatientId = (item) => String(item.patientUser?._id || '');
const getPatientName = (item) => item.patientUser?.name || 'Patient';
const getHospitalId = (item) => String(item.hospitalId?._id || 'independent');
const getHospitalName = (item) => item.hospitalId?.name || 'Independent clinic';

const buildFilterOptions = (items, getValue, getLabel) => {
  const optionMap = new Map();
  items.forEach((item) => {
    const value = getValue(item);
    if (!value || optionMap.has(value)) return;
    optionMap.set(value, getLabel(item));
  });
  return [...optionMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const tabs = [
  { id: 'overview', label: 'Home', icon: 'home' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'appointments', label: 'Visits', icon: 'calendar' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'report', label: 'New Report', icon: 'report' },
  { id: 'reports', label: 'Reports', icon: 'report' },
];

export function DoctorDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [profile, setProfile] = useState(initialProfile);
  const [hasProfile, setHasProfile] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportForm, setReportForm] = useState(initialReport);
  const [appointmentFilters, setAppointmentFilters] = useState({
    status: 'all',
    date: '',
    patient: 'all',
    hospital: 'all',
  });
  const [reportFilters, setReportFilters] = useState({ status: 'all', date: '', patient: 'all', hospital: 'all' });
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  const reportableAppointments = useMemo(
    () => appointments.filter((appointment) => ['confirmed', 'completed'].includes(appointment.status)),
    [appointments]
  );

  const selectedReportAppointment = useMemo(
    () => reportableAppointments.find((appointment) => appointment._id === reportForm.appointmentId),
    [reportableAppointments, reportForm.appointmentId]
  );

  const appointmentStats = useMemo(
    () => ({
      confirmed: appointments.filter((appointment) => appointment.status === 'confirmed').length,
      completed: appointments.filter((appointment) => appointment.status === 'completed').length,
      pending: appointments.filter((appointment) => appointment.status === 'pending').length,
      total: appointments.length,
    }),
    [appointments]
  );

  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((appointment) => ['pending', 'confirmed'].includes(appointment.status))
        .slice()
        .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0))[0],
    [appointments]
  );

  const latestReport = reports[0];

  const appointmentPatientOptions = useMemo(
    () => buildFilterOptions(appointments, getPatientId, getPatientName),
    [appointments]
  );

  const appointmentHospitalOptions = useMemo(
    () => buildFilterOptions(appointments, getHospitalId, getHospitalName),
    [appointments]
  );

  const reportPatientOptions = useMemo(
    () => buildFilterOptions(reports, getPatientId, getPatientName),
    [reports]
  );

  const reportHospitalOptions = useMemo(
    () => buildFilterOptions(reports, getHospitalId, getHospitalName),
    [reports]
  );

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const matchesStatus = appointmentFilters.status === 'all' || appointment.status === appointmentFilters.status;
        const matchesDate = !appointmentFilters.date || getDateKey(appointment.scheduledAt) === appointmentFilters.date;
        const matchesPatient = appointmentFilters.patient === 'all' || getPatientId(appointment) === appointmentFilters.patient;
        const matchesHospital = appointmentFilters.hospital === 'all' || getHospitalId(appointment) === appointmentFilters.hospital;
        return matchesStatus && matchesDate && matchesPatient && matchesHospital;
      }),
    [appointments, appointmentFilters]
  );

  const appointmentGroups = useMemo(
    () => groupByDate(filteredAppointments, (appointment) => appointment.scheduledAt, 'desc'),
    [filteredAppointments]
  );

  const filteredReports = useMemo(
    () =>
      reports.filter((report) => {
        const matchesStatus = reportFilters.status === 'all' || report.appointment?.status === reportFilters.status;
        const matchesDate = !reportFilters.date || getDateKey(report.createdAt) === reportFilters.date;
        const matchesPatient = reportFilters.patient === 'all' || getPatientId(report) === reportFilters.patient;
        const matchesHospital = reportFilters.hospital === 'all' || getHospitalId(report) === reportFilters.hospital;
        return matchesStatus && matchesDate && matchesPatient && matchesHospital;
      }),
    [reports, reportFilters]
  );

  const setField = (setter) => (event) => {
    const { name, value } = event.target;
    setter((current) => ({ ...current, [name]: value }));
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

    const [profileResult, appointmentResult, reportResult] = await Promise.allSettled([
      apiRequest('/doctor/me/profile', { method: 'GET' }, token),
      apiRequest('/appointment/my', { method: 'GET' }, token),
      apiRequest('/report/my', { method: 'GET' }, token),
    ]);

    if (profileResult.status === 'fulfilled' && profileResult.value.doctor) {
      const doctor = profileResult.value.doctor;
      setHasProfile(true);
      setProfile({
        specialty: doctor.specialty || '',
        licenseNumber: doctor.licenseNumber || '',
        experienceYears: doctor.experienceYears || 0,
        consultationFee: doctor.consultationFee || 0,
        maxDailyBookings: doctor.maxDailyBookings || 10,
        bio: doctor.bio || '',
      });
    }

    if (appointmentResult.status === 'fulfilled') {
      const items = appointmentResult.value.appointments || [];
      setAppointments(items);
      setReportForm((current) => ({
        ...current,
        appointmentId: current.appointmentId || items.find((item) => ['confirmed', 'completed'].includes(item.status))?._id || '',
      }));
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

  const saveProfile = async (event) => {
    event.preventDefault();

    const payload = {
      specialty: profile.specialty.trim(),
      licenseNumber: profile.licenseNumber.trim(),
      experienceYears: Number(profile.experienceYears) || 0,
      consultationFee: Number(profile.consultationFee) || 0,
      maxDailyBookings: Number(profile.maxDailyBookings) || 10,
      bio: profile.bio,
    };

    const method = hasProfile ? 'PUT' : 'POST';
    const createPath = hasProfile ? '/doctor/me/profile' : '/doctor/create-profile';
    const data = await run(
      () => apiRequest(createPath, { method, body: JSON.stringify(payload) }, token),
      hasProfile ? 'Profile updated' : 'Profile submitted for approval'
    );

    if (data) loadOverview();
  };

  const updateStatus = async (appointmentId, nextStatus) => {
    const data = await run(
      () =>
        apiRequest(
          `/appointment/${appointmentId}/status`,
          { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) },
          token
        ),
      'Appointment updated'
    );

    if (data) loadOverview();
  };

  const saveReport = async (event) => {
    event.preventDefault();

    if (!reportForm.appointmentId || !reportForm.diagnosis.trim()) {
      setStatus({ loading: false, error: 'Appointment and diagnosis are required', message: '' });
      return;
    }

    const payload = {
      appointmentId: reportForm.appointmentId,
      diagnosis: reportForm.diagnosis.trim(),
      prescription: toList(reportForm.prescription),
      testRecommendations: toList(reportForm.testRecommendations),
      followUpDate: reportForm.followUpDate || undefined,
      notes: reportForm.notes,
    };

    const data = await run(
      () => apiRequest('/report', { method: 'POST', body: JSON.stringify(payload) }, token),
      'Report saved'
    );

    if (data) {
      setReportForm(initialReport);
      loadOverview();
    }
  };

  return (
    <div className="workspace-grid">
      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'overview' && (
        <div className="role-overview-grid doctor-overview-grid">
          <section className="role-feature-panel doctor-feature-panel">
            <div>
              <span>Next step</span>
              <h3>{hasProfile ? 'Check today\'s visits' : 'Complete your profile'}</h3>
              <p>
                {hasProfile
                  ? 'Open Visits to confirm, complete, or cancel patient appointments.'
                  : 'Add your specialty, license, fee, and daily booking limit for approval.'}
              </p>
            </div>
            <button
              className="role-feature-button"
              type="button"
              onClick={() => setActiveTab(hasProfile ? 'appointments' : 'profile')}
            >
              {hasProfile ? 'Open Visits' : 'Open Profile'}
            </button>
          </section>

          <div className="role-metric-grid">
            <article className="role-metric-card">
              <span>Total</span>
              <strong>{appointmentStats.total}</strong>
              <small>Appointments</small>
            </article>
            <article className="role-metric-card">
              <span>Confirmed</span>
              <strong>{appointmentStats.confirmed}</strong>
              <small>Ready visits</small>
            </article>
            <article className="role-metric-card">
              <span>Completed</span>
              <strong>{appointmentStats.completed}</strong>
              <small>Closed visits</small>
            </article>
            <article className="role-metric-card">
              <span>Reports</span>
              <strong>{reports.length}</strong>
              <small>Saved records</small>
            </article>
          </div>

          <section className="role-action-panel">
            <div className="role-panel-heading">
              <span>Next Patient</span>
              <button type="button" onClick={() => setActiveTab('appointments')}>Open</button>
            </div>
            {nextAppointment ? (
              <article className="role-list-item">
                <div className="avatar avatar-mini">{(nextAppointment.patientUser?.name || 'P')[0]}</div>
                <div>
                  <strong>{nextAppointment.patientUser?.name || 'Patient'}</strong>
                  <small>{formatDateTime(nextAppointment.scheduledAt)} - {nextAppointment.reason}</small>
                </div>
                <StatusPill status={nextAppointment.status} />
              </article>
            ) : (
              <EmptyState title="No upcoming appointments" />
            )}
          </section>

          <section className="role-action-panel">
            <div className="role-panel-heading">
              <span>Latest Report</span>
              <button type="button" onClick={() => setActiveTab('reports')}>View all</button>
            </div>
            {latestReport ? (
              <article className="role-list-item">
                <div className="avatar avatar-mini">{(latestReport.patientUser?.name || 'P')[0]}</div>
                <div>
                  <strong>{latestReport.patientUser?.name || 'Patient'} - {latestReport.diagnosis}</strong>
                  <small>{formatDateTime(latestReport.createdAt)}</small>
                </div>
              </article>
            ) : (
              <EmptyState title="No reports yet" />
            )}
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
      <SectionCard
        title="Doctor Profile"
        description={hasProfile ? 'Keep your clinical profile and booking capacity current.' : 'Create your profile so admin can approve you for appointments.'}
      >
        <form className="form-grid two-column" onSubmit={saveProfile}>
          <Field label="Specialty">
            <input name="specialty" value={profile.specialty} onChange={setField(setProfile)} placeholder="Cardiology" />
          </Field>
          <Field label="License Number">
            <input name="licenseNumber" value={profile.licenseNumber} onChange={setField(setProfile)} placeholder="NMC-12345" disabled={hasProfile} />
          </Field>
          <Field label="Experience Years">
            <input name="experienceYears" type="number" min="0" value={profile.experienceYears} onChange={setField(setProfile)} />
          </Field>
          <Field label="Daily Booking Limit">
            <input name="maxDailyBookings" type="number" min="1" value={profile.maxDailyBookings} onChange={setField(setProfile)} />
          </Field>
          <Field label="Consultation Fee">
            <input name="consultationFee" type="number" min="0" value={profile.consultationFee} onChange={setField(setProfile)} />
          </Field>
          <Field label="Bio">
            <textarea name="bio" rows={4} value={profile.bio} onChange={setField(setProfile)} placeholder="Short professional summary" />
          </Field>
          <div className="form-footer">
            <button className="primary-action" disabled={status.loading}>
              {hasProfile ? 'Update Profile' : 'Create Profile'}
            </button>
          </div>
        </form>
      </SectionCard>
      )}

      {activeTab === 'appointments' && (
      <SectionCard title="Appointments" description="Confirm, complete, or cancel patient appointments.">
        <div className="filter-bar">
          <Field label="Status">
            <select
              value={appointmentFilters.status}
              onChange={(event) => setAppointmentFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No show</option>
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={appointmentFilters.date}
              onChange={(event) => setAppointmentFilters((current) => ({ ...current, date: event.target.value }))}
            />
          </Field>
          <Field label="Patient">
            <select
              value={appointmentFilters.patient}
              onChange={(event) => setAppointmentFilters((current) => ({ ...current, patient: event.target.value }))}
            >
              <option value="all">All patients</option>
              {appointmentPatientOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Hospital">
            <select
              value={appointmentFilters.hospital}
              onChange={(event) => setAppointmentFilters((current) => ({ ...current, hospital: event.target.value }))}
            >
              <option value="all">All hospitals</option>
              {appointmentHospitalOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <button
            className="secondary-action compact-button filter-clear-button"
            type="button"
            onClick={() => setAppointmentFilters({ status: 'all', date: '', patient: 'all', hospital: 'all' })}
          >
            Clear
          </button>
        </div>

        <div className="date-group-stack">
          {appointments.length === 0 ? (
            <EmptyState title="No appointments assigned" />
          ) : appointmentGroups.length === 0 ? (
            <EmptyState title="No visits match your filters" description="Clear filters or choose another date/status." />
          ) : (
            appointmentGroups.map((group) => (
              <section key={group.date} className="date-group">
                <h4>{formatDateGroup(group.date)}</h4>
                <div className="list-stack">
                  {group.items.map((appointment) => (
                    <article key={appointment._id} className="appointment-card appointment-card-expanded">
                      <div>
                        <strong>{appointment.patientUser?.name || 'Patient'}</strong>
                        <p>{appointment.hospitalId?.name || 'Independent clinic'} - Token #{appointment.queueNumber}</p>
                        <small>{formatDateTime(appointment.scheduledAt)} - {appointment.reason}</small>
                      </div>
                      <div className="appointment-actions">
                        <StatusPill status={appointment.status} />
                        <div className="inline-actions">
                          {['confirmed', 'completed', 'cancelled', 'no_show'].map((nextStatus) => (
                            <button
                              key={nextStatus}
                              type="button"
                              className="secondary-action compact-button"
                              onClick={() => updateStatus(appointment._id, nextStatus)}
                              disabled={status.loading || appointment.status === nextStatus}
                            >
                              {nextStatus.replace('_', ' ')}
                            </button>
                          ))}
                          {['confirmed', 'completed'].includes(appointment.status) && (
                            <button
                              type="button"
                              className="primary-action compact-button"
                              onClick={() => setReportForm((current) => ({ ...current, appointmentId: appointment._id }))}
                            >
                              Report
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </SectionCard>
      )}

      {activeTab === 'chat' && (
        <SectionCard title="Patient Chat" description="Reply after a patient starts a conversation.">
          <ChatPanel />
        </SectionCard>
      )}

      {activeTab === 'report' && (
      <SectionCard title="Medical Report" description="Create or update a report for confirmed or completed appointments.">
        <div className="report-composer-grid">
          <form className="form-grid report-form" onSubmit={saveReport}>
            <div className="report-form-group">
              <Field label="Appointment">
                <select name="appointmentId" value={reportForm.appointmentId} onChange={setField(setReportForm)}>
                  <option value="">Choose appointment</option>
                  {reportableAppointments.map((appointment) => (
                    <option key={appointment._id} value={appointment._id}>
                      {appointment.patientUser?.name || 'Patient'} - {formatDateTime(appointment.scheduledAt)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Diagnosis">
                <input name="diagnosis" value={reportForm.diagnosis} onChange={setField(setReportForm)} placeholder="Diagnosis" />
              </Field>
            </div>
            <div className="form-grid two-column">
              <TagListField
                label="Prescription"
                value={reportForm.prescription}
                onChange={(prescription) => setReportForm((current) => ({ ...current, prescription }))}
                placeholder="Add medicine"
              />
              <TagListField
                label="Tests"
                value={reportForm.testRecommendations}
                onChange={(testRecommendations) => setReportForm((current) => ({ ...current, testRecommendations }))}
                placeholder="Add test"
              />
            </div>
            <div className="report-form-group">
              <Field label="Follow-up Date">
                <input name="followUpDate" type="date" value={reportForm.followUpDate} onChange={setField(setReportForm)} />
              </Field>
              <Field label="Notes">
                <textarea name="notes" rows={4} value={reportForm.notes} onChange={setField(setReportForm)} />
              </Field>
            </div>
            <div className="form-footer">
              <button className="primary-action" disabled={status.loading}>Save Report</button>
            </div>
          </form>
          <ReportDraftPreview form={reportForm} appointment={selectedReportAppointment} />
        </div>
      </SectionCard>
      )}

      {activeTab === 'reports' && (
      <SectionCard title="My Reports" description="Your saved clinical reports.">
        <div className="filter-bar">
          <Field label="Status">
            <select
              value={reportFilters.status}
              onChange={(event) => setReportFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No show</option>
            </select>
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={reportFilters.date}
              onChange={(event) => setReportFilters((current) => ({ ...current, date: event.target.value }))}
            />
          </Field>
          <Field label="Patient">
            <select
              value={reportFilters.patient}
              onChange={(event) => setReportFilters((current) => ({ ...current, patient: event.target.value }))}
            >
              <option value="all">All patients</option>
              {reportPatientOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Hospital">
            <select
              value={reportFilters.hospital}
              onChange={(event) => setReportFilters((current) => ({ ...current, hospital: event.target.value }))}
            >
              <option value="all">All hospitals</option>
              {reportHospitalOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <button
            className="secondary-action compact-button filter-clear-button"
            type="button"
            onClick={() => setReportFilters({ status: 'all', date: '', patient: 'all', hospital: 'all' })}
          >
            Clear
          </button>
        </div>

        <div className="list-stack">
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" />
          ) : filteredReports.length === 0 ? (
            <EmptyState title="No reports match your filters" description="Clear filters or choose another date/status." />
          ) : (
            filteredReports.map((report) => (
              <article key={report._id} className="compact-item">
                <strong>{report.patientUser?.name || 'Patient'} - {report.diagnosis}</strong>
                <span>{report.hospitalId?.name || 'Independent clinic'} - {formatDateTime(report.createdAt)}</span>
                {report.notes && <small>{report.notes}</small>}
                <div className="inline-actions">
                  <Link className="secondary-action compact-button" to={`/app/reports/${report.id || report._id}`}>View</Link>
                </div>
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
