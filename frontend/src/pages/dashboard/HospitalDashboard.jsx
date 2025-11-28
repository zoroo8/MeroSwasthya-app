import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest, getAssetUrl } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ReportDraftPreview, TagListField } from '../../components/common/ReportComposer';
import {
  EmptyState,
  Field,
  Notice,
  SectionCard,
  StatusPill,
  TabNav,
  formatAvailabilitySlots,
  formatDateGroup,
  formatDateTime,
  getDateKey,
  groupByDate,
} from '../../components/common/DashboardComponents';

const initialHospital = {
  name: '',
  address: '',
  phone: '',
  email: '',
  bannerImage: '',
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

const slotsToText = (slots = []) =>
  slots.map((slot) => `${slot.date}:${slot.maxDailyBookings}`).join(', ');

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const availabilityToMap = (value = '') =>
  toList(value).reduce((slots, item) => {
    const [date, rawLimit] = item.split(':').map((part) => part.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return slots;

    const limit = Math.floor(Number(rawLimit));
    slots[date] = Number.isFinite(limit) && limit > 0 ? limit : 10;
    return slots;
  }, {});

const availabilityToText = (slots) =>
  Object.entries(slots)
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([date, limit]) => `${date}:${limit}`)
    .join(', ');

const monthCells = (month) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay.getDay() }, (_, index) => ({ id: `blank-${index}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = new Date(month.getFullYear(), month.getMonth(), index + 1);
      return { id: dateKey(day), day };
    }),
  ];
};

function AvailabilityCalendar({ value, onChange }) {
  const slots = useMemo(() => availabilityToMap(value), [value]);
  const selectedDates = Object.keys(slots).sort();
  const [month, setMonth] = useState(() => {
    const firstDate = selectedDates[0] ? new Date(`${selectedDates[0]}T00:00:00`) : new Date();
    return new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  });

  const updateSlots = (nextSlots) => onChange(availabilityToText(nextSlots));
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="availability-calendar">
      <div className="calendar-toolbar">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          {'<'}
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          {'>'}
        </button>
      </div>
      <div className="calendar-grid calendar-weekdays" aria-hidden="true">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>
      <div className="calendar-grid">
        {monthCells(month).map((cell) => {
          if (cell.blank) return <span key={cell.id} className="calendar-day calendar-empty" />;

          const key = dateKey(cell.day);
          const selected = Object.hasOwn(slots, key);
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => {
                const nextSlots = { ...slots };
                if (selected) {
                  delete nextSlots[key];
                } else {
                  nextSlots[key] = 10;
                }
                updateSlots(nextSlots);
              }}
            >
              {cell.day.getDate()}
            </button>
          );
        })}
      </div>
      {selectedDates.length > 0 && (
        <div className="calendar-limit-list">
          {selectedDates.map((selectedDate) => (
            <label key={selectedDate} className="calendar-limit-row">
              <span>{selectedDate}</span>
              <input
                type="number"
                min="1"
                value={slots[selectedDate]}
                aria-label={`Patient limit for ${selectedDate}`}
                onChange={(event) => {
                  const limit = Math.floor(Number(event.target.value));
                  updateSlots({ ...slots, [selectedDate]: Number.isFinite(limit) && limit > 0 ? limit : 1 });
                }}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const getHospitalImage = (hospital) => {
  return hospital?.bannerImage || hospital?.adminUser?.profileImage || '';
};

const getPatientId = (item) => String(item.patientUser?._id || '');
const getPatientName = (item) => item.patientUser?.name || 'Patient';
const getDoctorId = (item) => String(item.doctor?._id || '');
const getDoctorName = (item) => item.doctor?.user?.name || 'Doctor';
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
  { id: 'hospital', label: 'Profile', icon: 'hospital' },
  { id: 'doctors', label: 'Doctors', icon: 'users' },
  { id: 'appointments', label: 'Visits', icon: 'calendar' },
  { id: 'report', label: 'New Report', icon: 'report' },
  { id: 'reports', label: 'Reports', icon: 'report' },
];

export function HospitalDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [hospitals, setHospitals] = useState([]);
  const [hospitalId, setHospitalId] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorEdits, setDoctorEdits] = useState({});
  const [candidateSearch, setCandidateSearch] = useState('');
  const [doctorCandidates, setDoctorCandidates] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [reports, setReports] = useState([]);
  const [hospitalForm, setHospitalForm] = useState(initialHospital);
  const [candidateAvailability, setCandidateAvailability] = useState({});
  const [reportForm, setReportForm] = useState(initialReport);
  const [appointmentFilters, setAppointmentFilters] = useState({
    status: 'all',
    date: '',
    patient: 'all',
    doctor: 'all',
    hospital: 'all',
  });
  const [reportFilters, setReportFilters] = useState({
    status: 'all',
    date: '',
    patient: 'all',
    doctor: 'all',
    hospital: 'all',
  });
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  const selectedHospital = useMemo(
    () => hospitals.find((hospital) => hospital._id === hospitalId),
    [hospitals, hospitalId]
  );

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
      total: appointments.length,
      confirmed: appointments.filter((appointment) => appointment.status === 'confirmed').length,
      completed: appointments.filter((appointment) => appointment.status === 'completed').length,
      pending: appointments.filter((appointment) => appointment.status === 'pending').length,
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

  const appointmentDoctorOptions = useMemo(
    () => buildFilterOptions(appointments, getDoctorId, getDoctorName),
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

  const reportDoctorOptions = useMemo(
    () => buildFilterOptions(reports, getDoctorId, getDoctorName),
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
        const matchesDoctor = appointmentFilters.doctor === 'all' || getDoctorId(appointment) === appointmentFilters.doctor;
        const matchesHospital = appointmentFilters.hospital === 'all' || getHospitalId(appointment) === appointmentFilters.hospital;
        return matchesStatus && matchesDate && matchesPatient && matchesDoctor && matchesHospital;
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
        const matchesDoctor = reportFilters.doctor === 'all' || getDoctorId(report) === reportFilters.doctor;
        const matchesHospital = reportFilters.hospital === 'all' || getHospitalId(report) === reportFilters.hospital;
        return matchesStatus && matchesDate && matchesPatient && matchesDoctor && matchesHospital;
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

    const [hospitalResult, appointmentResult, reportResult] = await Promise.allSettled([
      apiRequest('/hospital/mine', { method: 'GET' }, token),
      apiRequest('/appointment/my', { method: 'GET' }, token),
      apiRequest('/report/my', { method: 'GET' }, token),
    ]);

    if (hospitalResult.status === 'fulfilled') {
      const items = hospitalResult.value.hospitals || [];
      setHospitals(items);
      setHospitalId((current) => current || items[0]?._id || '');
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

  const loadDoctors = async (id = hospitalId) => {
    if (!id) {
      setDoctors([]);
      return;
    }

    const data = await run(
      () => apiRequest(`/hospital/${id}/doctors`, { method: 'GET' }, token),
      ''
    );
    if (data) {
      const items = data.doctors || [];
      setDoctors(items);
      setDoctorEdits(
        items.reduce((edits, doctor) => {
          edits[doctor._id] = {
            availabilitySlots: slotsToText(doctor.availabilitySlots || []),
          };
          return edits;
        }, {})
      );
    }
  };

  const searchDoctors = async (event) => {
    event?.preventDefault();

    if (!hospitalId) {
      setStatus({ loading: false, error: 'Create or choose a hospital first', message: '' });
      return;
    }

    const query = new URLSearchParams({ hospitalId });
    if (candidateSearch.trim()) {
      query.set('search', candidateSearch.trim());
    }

    const data = await run(
      () => apiRequest(`/hospital/doctor-candidates?${query.toString()}`, { method: 'GET' }, token),
      ''
    );

    if (data) setDoctorCandidates(data.doctors || []);
  };

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token]);

  useEffect(() => {
    if (hospitalId) {
      loadDoctors(hospitalId);
      setDoctorCandidates([]);
    }
  }, [hospitalId]);

  useEffect(() => {
    if (selectedHospital) {
      setHospitalForm({
        name: selectedHospital.name || '',
        address: selectedHospital.address || '',
        phone: selectedHospital.phone || '',
        email: selectedHospital.email || '',
        bannerImage: selectedHospital.bannerImage || '',
      });
    } else {
      setHospitalForm(initialHospital);
    }
  }, [selectedHospital]);

  const createHospital = async (event) => {
    event.preventDefault();
    const isUpdate = Boolean(hospitalId);

    const payload = {
      name: hospitalForm.name.trim(),
      address: hospitalForm.address,
      phone: hospitalForm.phone,
      email: hospitalForm.email,
      bannerImage: hospitalForm.bannerImage,
    };

    const data = await run(
      () =>
        apiRequest(
          isUpdate ? `/hospital/${hospitalId}` : '/hospital',
          { method: isUpdate ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
          token
        ),
      isUpdate ? 'Hospital updated' : 'Hospital saved'
    );

    if (data) {
      await loadOverview();
      setHospitalId(data.hospital?._id || hospitalId);
    }
  };

  const addDoctor = async (candidate) => {
    if (!hospitalId) {
      setStatus({ loading: false, error: 'Create or choose a hospital first', message: '' });
      return;
    }

    if (!candidate.profile) {
      setStatus({ loading: false, error: 'This doctor has not created a profile yet', message: '' });
      return;
    }

    const candidateKey = String(candidate.user.id || candidate.user._id || candidate.user.email);
    const availabilitySlots = toList(candidateAvailability[candidateKey] || '');
    if (availabilitySlots.length === 0) {
      setStatus({ loading: false, error: 'Add at least one date and patient limit for this doctor', message: '' });
      return;
    }

    const payload = {
      doctorEmail: candidate.user.email,
      specialty: candidate.profile.specialty,
      licenseNumber: candidate.profile.licenseNumber,
      experienceYears: candidate.profile.experienceYears || 0,
      consultationFee: candidate.profile.consultationFee || 0,
      availabilitySlots,
    };

    const data = await run(
      () => apiRequest(`/hospital/${hospitalId}/doctors`, { method: 'POST', body: JSON.stringify(payload) }, token),
      'Doctor added to hospital'
    );

    if (data) {
      await loadDoctors();
      await searchDoctors();
      setCandidateAvailability((current) => {
        const next = { ...current };
        delete next[candidateKey];
        return next;
      });
    }
  };

  const updateDoctorAvailability = async (doctor) => {
    const edit = doctorEdits[doctor._id] || {};
    const availabilitySlots = toList(edit.availabilitySlots || '');

    if (availabilitySlots.length === 0) {
      setStatus({ loading: false, error: 'Add at least one date and patient limit for this doctor', message: '' });
      return;
    }

    const data = await run(
      () =>
        apiRequest(
          `/hospital/${hospitalId}/doctors/${doctor._id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              availabilitySlots,
            }),
          },
          token
        ),
      'Doctor availability updated'
    );

    if (data) loadDoctors();
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
        <div className="role-overview-grid hospital-overview-grid">
          <section className="role-feature-panel hospital-feature-panel">
            <div>
              <span>Next step</span>
              <h3>{selectedHospital ? 'Manage doctors and visits' : 'Set up your hospital'}</h3>
              <p>
                {selectedHospital
                  ? 'Keep doctor availability updated so patients can book the right appointment.'
                  : 'Create a hospital profile before linking doctors and accepting appointments.'}
              </p>
            </div>
            <button
              className="role-feature-button"
              type="button"
              onClick={() => setActiveTab(selectedHospital ? 'doctors' : 'hospital')}
            >
              {selectedHospital ? 'Open Doctors' : 'Open Profile'}
            </button>
            {getHospitalImage(selectedHospital) && (
              <img className="hospital-feature-image" src={getAssetUrl(getHospitalImage(selectedHospital))} alt="" />
            )}
          </section>

          <div className="role-metric-grid hospital-metric-grid">
            <article className="role-metric-card">
              <span>Doctors</span>
              <strong>{doctors.length}</strong>
              <small>Linked staff</small>
            </article>
            <article className="role-metric-card">
              <span>Appointments</span>
              <strong>{appointmentStats.total}</strong>
              <small>Total visits</small>
            </article>
            <article className="role-metric-card">
              <span>Confirmed</span>
              <strong>{appointmentStats.confirmed}</strong>
              <small>Ready visits</small>
            </article>
            <article className="role-metric-card">
              <span>Reports</span>
              <strong>{reports.length}</strong>
              <small>Saved records</small>
            </article>
          </div>

          <section className="role-action-panel">
            <div className="role-panel-heading">
              <span>Next Appointment</span>
              <button type="button" onClick={() => setActiveTab('appointments')}>Open</button>
            </div>
            {nextAppointment ? (
              <article className="role-list-item">
                <div className="avatar avatar-mini">{(nextAppointment.patientUser?.name || 'P')[0]}</div>
                <div>
                  <strong>{nextAppointment.patientUser?.name || 'Patient'}</strong>
                  <small>
                    {nextAppointment.doctor?.user?.name || 'Doctor'} - {formatDateTime(nextAppointment.scheduledAt)}
                  </small>
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
                  <small>{latestReport.doctor?.user?.name || 'Doctor'} - {formatDateTime(latestReport.createdAt)}</small>
                </div>
              </article>
            ) : (
              <EmptyState title="No reports yet" />
            )}
          </section>
        </div>
      )}

      {activeTab === 'hospital' && (
        <SectionCard title="Hospital Profile" description="Create and manage the hospital connected to your account.">
          <div className="hospital-switcher">
            <Field label="Current Hospital">
              <select value={hospitalId} onChange={(event) => setHospitalId(event.target.value)}>
                <option value="">No hospital selected</option>
                {hospitals.map((hospital) => (
                  <option key={hospital._id} value={hospital._id}>{hospital.name}</option>
                ))}
              </select>
            </Field>
            <div className="booking-summary">
              <span>{selectedHospital?.name || 'No hospital yet'}</span>
              <strong>{selectedHospital?.address || 'Create a hospital profile to begin'}</strong>
              <small>{selectedHospital?.phone || selectedHospital?.email || 'Doctors and appointments will appear after setup.'}</small>
            </div>
          </div>

          {getHospitalImage(selectedHospital) && <img className="hospital-banner" src={getAssetUrl(getHospitalImage(selectedHospital))} alt="" />}

          <form className="form-grid two-column" onSubmit={createHospital}>
            <Field label="Hospital Name">
              <input name="name" value={hospitalForm.name} onChange={setField(setHospitalForm)} placeholder="City Care" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" value={hospitalForm.email} onChange={setField(setHospitalForm)} placeholder="info@hospital.com" />
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
              <button className="primary-action" disabled={status.loading}>{hospitalId ? 'Save Hospital' : 'Create Hospital'}</button>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === 'doctors' && (
        <>
          <SectionCard title="Add Doctor From Database" description="Search doctor-role users and add them with date-specific booking limits.">
            <form className="form-grid two-column" onSubmit={searchDoctors}>
              <Field label="Search Doctors">
                <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Name, email, or phone" />
              </Field>
              <div className="form-footer">
                <button className="primary-action" disabled={status.loading || !hospitalId}>Search</button>
              </div>
            </form>

            <div className="doctor-grid">
              {doctorCandidates.length === 0 ? (
                <EmptyState title="No doctor search results" description="Search to find doctors already registered in the database." />
              ) : (
                doctorCandidates.map((candidate) => {
                  const candidateKey = String(candidate.user.id || candidate.user._id || candidate.user.email);

                  return (
                  <article key={candidateKey} className="doctor-card doctor-candidate-card">
                    <div className="doctor-card-title">
                      {candidate.user.profileImage ? (
                        <img className="avatar" src={getAssetUrl(candidate.user.profileImage)} alt="" />
                      ) : (
                        <div className="avatar">{(candidate.user.name || 'D')[0]}</div>
                      )}
                      <strong>{candidate.user.name || 'Doctor'}</strong>
                    </div>
                    <span>{candidate.user.email}</span>
                    {candidate.profile ? (
                      <>
                        <small>{candidate.profile.specialty} - License {candidate.profile.licenseNumber}</small>
                        <small>{candidate.profile.experienceYears || 0} years experience</small>
                      </>
                    ) : (
                      <small>Profile missing: doctor must create specialty and license details first.</small>
                    )}
                    {!candidate.isLinked && candidate.profile && (
                      <Field label="Available Dates and Limits">
                        <AvailabilityCalendar
                          value={candidateAvailability[candidateKey] || ''}
                          onChange={(availabilitySlots) =>
                            setCandidateAvailability((current) => ({ ...current, [candidateKey]: availabilitySlots }))
                          }
                        />
                      </Field>
                    )}
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="primary-action compact-button"
                        disabled={status.loading || candidate.isLinked || !candidate.profile}
                        onClick={() => addDoctor(candidate)}
                      >
                        {candidate.isLinked ? 'Already Added' : 'Add Doctor'}
                      </button>
                    </div>
                  </article>
                  );
                })
              )}
            </div>
          </SectionCard>

          <SectionCard title="Hospital Doctors" description="Set each available date with the number of patients this doctor will check that day.">
            <div className="doctor-grid">
              {doctors.length === 0 ? (
                <EmptyState title="No doctors linked" description="Hire or link a doctor to start accepting appointments." />
              ) : (
                doctors.map((doctor) => (
                  <article key={doctor._id} className="doctor-card">
                    <div className="doctor-card-title">
                      {doctor.user?.profileImage ? (
                        <img className="avatar" src={getAssetUrl(doctor.user.profileImage)} alt="" />
                      ) : (
                        <div className="avatar">{(doctor.user?.name || 'D')[0]}</div>
                      )}
                      <strong>{doctor.user?.name || 'Doctor'}</strong>
                    </div>
                    <span>{doctor.specialty}</span>
                    <small>{doctor.user?.email || 'No email'}</small>
                    <small>{formatAvailabilitySlots(doctor.availabilitySlots)}</small>
                    <Field label="Available Dates and Limits">
                      <AvailabilityCalendar
                        value={doctorEdits[doctor._id]?.availabilitySlots ?? slotsToText(doctor.availabilitySlots || [])}
                        onChange={(availabilitySlots) =>
                          setDoctorEdits((current) => ({
                            ...current,
                            [doctor._id]: {
                              ...(current[doctor._id] || {}),
                              availabilitySlots,
                            },
                          }))
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="secondary-action compact-button"
                      disabled={status.loading}
                      onClick={() => updateDoctorAvailability(doctor)}
                    >
                      Save Availability
                    </button>
                  </article>
                ))
              )}
            </div>
          </SectionCard>
        </>
      )}

      {activeTab === 'appointments' && (
        <SectionCard title="Appointments" description="Appointments booked under your hospital.">
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
            <Field label="Doctor">
              <select
                value={appointmentFilters.doctor}
                onChange={(event) => setAppointmentFilters((current) => ({ ...current, doctor: event.target.value }))}
              >
                <option value="all">All doctors</option>
                {appointmentDoctorOptions.map((option) => (
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
              onClick={() => setAppointmentFilters({
                status: 'all',
                date: '',
                patient: 'all',
                doctor: 'all',
                hospital: 'all',
              })}
            >
              Clear
            </button>
          </div>

          <div className="date-group-stack">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments yet" />
            ) : appointmentGroups.length === 0 ? (
              <EmptyState title="No visits match your filters" description="Clear filters or choose another date/status." />
            ) : (
              appointmentGroups.map((group) => (
                <section key={group.date} className="date-group">
                  <h4>{formatDateGroup(group.date)}</h4>
                  <div className="list-stack">
                    {group.items.map((appointment) => (
                      <article key={appointment._id} className="appointment-card">
                        <div>
                          <strong>{appointment.patientUser?.name || 'Patient'}</strong>
                          <p>
                            {appointment.doctor?.user?.name || 'Doctor'} - {appointment.hospitalId?.name || 'Independent clinic'} - Token #{appointment.queueNumber}
                          </p>
                          <small>{formatDateTime(appointment.scheduledAt)}</small>
                        </div>
                        <div className="appointment-actions">
                          <StatusPill status={appointment.status} />
                          {['confirmed', 'completed'].includes(appointment.status) && (
                            <button
                              type="button"
                              className="primary-action compact-button"
                              onClick={() => {
                                setReportForm((current) => ({ ...current, appointmentId: appointment._id }));
                                setActiveTab('report');
                              }}
                            >
                              Report
                            </button>
                          )}
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

      {activeTab === 'report' && (
        <SectionCard title="Create Medical Report" description="Reports can be added after an appointment is confirmed or completed.">
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
                  <input name="diagnosis" value={reportForm.diagnosis} onChange={setField(setReportForm)} />
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
        <SectionCard title="Reports" description="Reports created under your hospital.">
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
            <Field label="Doctor">
              <select
                value={reportFilters.doctor}
                onChange={(event) => setReportFilters((current) => ({ ...current, doctor: event.target.value }))}
              >
                <option value="all">All doctors</option>
                {reportDoctorOptions.map((option) => (
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
              onClick={() => setReportFilters({
                status: 'all',
                date: '',
                patient: 'all',
                doctor: 'all',
                hospital: 'all',
              })}
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
                  <span>{report.doctor?.user?.name || 'Doctor'} - {report.hospitalId?.name || 'Independent clinic'}</span>
                  <small>{formatDateTime(report.createdAt)} - {String(report.appointment?.status || 'status unavailable').replace('_', ' ')}</small>
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
