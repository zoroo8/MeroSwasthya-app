import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, getAssetUrl } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { ChatPanel } from '../../components/common/ChatPanel';
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

const initialProfile = {
  dateOfBirth: '',
  gender: 'male',
  bloodGroup: 'O+',
  address: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  allergies: '',
  chronicConditions: '',
};

const initialBooking = {
  appointmentDate: '',
  reason: '',
  notes: '',
};

const toList = (value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getHospitalImage = (hospital) => {
  return hospital?.bannerImage || hospital?.adminUser?.profileImage || '';
};

const getAppointmentDoctorId = (appointment) => String(appointment.doctor?._id || '');
const getAppointmentDoctorName = (appointment) => appointment.doctor?.user?.name || 'Doctor';
const getAppointmentHospitalId = (appointment) => String(appointment.hospitalId?._id || 'independent');
const getAppointmentHospitalName = (appointment) => appointment.hospitalId?.name || 'Independent clinic';
const getHistoryDoctorId = (item) => String(item.doctor?.id || '');
const getHistoryDoctorName = (item) => item.doctor?.name || 'Doctor';
const getHistoryHospitalId = (item) => String(item.hospital?.id || 'independent');
const getHistoryHospitalName = (item) => item.hospital?.name || 'Independent clinic';

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

const getInitialPatientTab = () => {
  if (typeof window === 'undefined') return 'home';
  return window.sessionStorage.getItem('patientActiveTab') || 'home';
};

const tabs = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'booking', label: 'Book', icon: 'search' },
  { id: 'appointments', label: 'Appointments', icon: 'calendar' },
  { id: 'history', label: 'Records', icon: 'report' },
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
];

export function PatientDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(getInitialPatientTab);
  const [profile, setProfile] = useState(initialProfile);
  const [hospitals, setHospitals] = useState([]);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalId, setHospitalId] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [booking, setBooking] = useState(initialBooking);
  const [appointments, setAppointments] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedHospitalDetails, setSelectedHospitalDetails] = useState(null);
  const [appointmentFilters, setAppointmentFilters] = useState({ status: 'all', date: '', doctor: 'all', hospital: 'all' });
  const [historyFilters, setHistoryFilters] = useState({ status: 'all', date: '', report: 'all', doctor: 'all', hospital: 'all' });
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  const selectedHospital = useMemo(
    () => selectedHospitalDetails || hospitals.find((hospital) => hospital._id === hospitalId),
    [hospitals, hospitalId, selectedHospitalDetails]
  );

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor._id === doctorId),
    [doctors, doctorId]
  );

  const selectedHospitalAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => String(appointment.hospitalId?._id || appointment.hospitalId) === String(hospitalId)
      ),
    [appointments, hospitalId]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => ['pending', 'confirmed'].includes(appointment.status))
        .slice()
        .sort((a, b) => new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0)),
    [appointments]
  );

  const upcomingAppointment = upcomingAppointments[0];
  const recentVisits = history.slice(0, 2);

  const appointmentDoctorOptions = useMemo(
    () => buildFilterOptions(appointments, getAppointmentDoctorId, getAppointmentDoctorName),
    [appointments]
  );

  const appointmentHospitalOptions = useMemo(
    () => buildFilterOptions(appointments, getAppointmentHospitalId, getAppointmentHospitalName),
    [appointments]
  );

  const historyDoctorOptions = useMemo(
    () => buildFilterOptions(history, getHistoryDoctorId, getHistoryDoctorName),
    [history]
  );

  const historyHospitalOptions = useMemo(
    () => buildFilterOptions(history, getHistoryHospitalId, getHistoryHospitalName),
    [history]
  );

  const filteredAppointments = useMemo(
    () =>
      appointments.filter((appointment) => {
        const matchesStatus = appointmentFilters.status === 'all' || appointment.status === appointmentFilters.status;
        const matchesDate = !appointmentFilters.date || getDateKey(appointment.scheduledAt) === appointmentFilters.date;
        const matchesDoctor = appointmentFilters.doctor === 'all' || getAppointmentDoctorId(appointment) === appointmentFilters.doctor;
        const matchesHospital = appointmentFilters.hospital === 'all' || getAppointmentHospitalId(appointment) === appointmentFilters.hospital;
        return matchesStatus && matchesDate && matchesDoctor && matchesHospital;
      }),
    [appointments, appointmentFilters]
  );

  const appointmentGroups = useMemo(
    () => groupByDate(filteredAppointments, (appointment) => appointment.scheduledAt, 'desc'),
    [filteredAppointments]
  );

  const filteredHistory = useMemo(
    () =>
      history.filter((item) => {
        const matchesStatus = historyFilters.status === 'all' || item.status === historyFilters.status;
        const matchesDate = !historyFilters.date || getDateKey(item.date) === historyFilters.date;
        const matchesDoctor = historyFilters.doctor === 'all' || getHistoryDoctorId(item) === historyFilters.doctor;
        const matchesHospital = historyFilters.hospital === 'all' || getHistoryHospitalId(item) === historyFilters.hospital;
        const matchesReport =
          historyFilters.report === 'all' ||
          (historyFilters.report === 'with' && item.report) ||
          (historyFilters.report === 'without' && !item.report);

        return matchesStatus && matchesDate && matchesDoctor && matchesHospital && matchesReport;
      }),
    [history, historyFilters]
  );

  const historyGroups = useMemo(
    () => groupByDate(filteredHistory, (item) => item.date, 'desc'),
    [filteredHistory]
  );

  const availableBookingSlots = useMemo(() => {
    const slots = selectedDoctor
      ? selectedDoctor.availabilitySlots || []
      : doctors.flatMap((doctor) => doctor.availabilitySlots || []);

    const slotByDate = new Map();
    slots.forEach((slot) => {
      if (!slotByDate.has(slot.date)) {
        slotByDate.set(slot.date, slot);
      }
    });

    return [...slotByDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedDoctor, doctors]);

  const availableBookingDates = useMemo(() => {
    return availableBookingSlots.map((slot) => slot.date);
  }, [availableBookingSlots]);

  const getDateLabel = (date) => {
    const slot = availableBookingSlots.find((item) => item.date === date);
    return slot ? `${date} (${slot.maxDailyBookings} patients)` : date;
  };

  const availableBookingDateKey = availableBookingDates.join('|');

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

    const [hospitalResult, appointmentResult, historyResult, profileResult] =
      await Promise.allSettled([
        apiRequest('/hospital', { method: 'GET' }, token),
        apiRequest('/appointment/my', { method: 'GET' }, token),
        apiRequest('/patient/me/history', { method: 'GET' }, token),
        apiRequest('/patient/me', { method: 'GET' }, token),
      ]);

    if (hospitalResult.status === 'fulfilled') {
      const items = hospitalResult.value.hospitals || [];
      setHospitals(items);
      setHospitalId((current) => (items.some((hospital) => hospital._id === current) ? current : ''));
    }

    if (appointmentResult.status === 'fulfilled') {
      setAppointments(appointmentResult.value.appointments || []);
    }

    if (historyResult.status === 'fulfilled') {
      setHistory(historyResult.value.history || []);
    }

    if (profileResult.status === 'fulfilled' && profileResult.value.profile) {
      const saved = profileResult.value.profile;
      setProfile({
        dateOfBirth: saved.dateOfBirth ? saved.dateOfBirth.slice(0, 10) : '',
        gender: saved.gender || 'male',
        bloodGroup: saved.bloodGroup || 'O+',
        address: saved.address || '',
        emergencyContactName: saved.emergencyContactName || '',
        emergencyContactPhone: saved.emergencyContactPhone || '',
        allergies: (saved.allergies || []).join(', '),
        chronicConditions: (saved.chronicConditions || []).join(', '),
      });
    }

    setStatus((current) => ({ ...current, loading: false }));
  };

  useEffect(() => {
    if (token) {
      loadOverview();
    }
  }, [token]);

  useEffect(() => {
    window.sessionStorage.setItem('patientActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    setBooking((current) => {
      if (availableBookingDates.includes(current.appointmentDate)) {
        return current;
      }

      return {
        ...current,
        appointmentDate: availableBookingDates[0] || '',
      };
    });
  }, [availableBookingDateKey]);

  const resetHospitalBooking = () => {
    setDoctors([]);
    setDoctorId('');
    setDoctorSearch('');
    setSpecialty('');
    setSelectedHospitalDetails(null);
    setBooking((current) => ({ ...current, appointmentDate: '' }));
  };

  const selectHospital = (id) => {
    setHospitalId(id);
    resetHospitalBooking();
  };

  const openHospitalDetails = (id) => {
    navigate(`/app/hospitals/${id}`);
  };

  const searchHospitals = async (event) => {
    event?.preventDefault();
    const query = new URLSearchParams();
    if (hospitalSearch.trim()) {
      query.set('search', hospitalSearch.trim());
    }

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await run(
      () => apiRequest(`/hospital${queryString}`, { method: 'GET' }, token),
      'Hospitals loaded'
    );

    if (data) {
      const items = data.hospitals || [];
      setHospitals(items);
      setHospitalId((current) => (items.some((hospital) => hospital._id === current) ? current : ''));
      if (!items.some((hospital) => hospital._id === hospitalId)) {
        resetHospitalBooking();
      }
    }
  };

  const loadDoctors = async (id = hospitalId, options = {}) => {
    if (!id) {
      setStatus({ loading: false, error: 'Choose a hospital first', message: '' });
      return;
    }

    const query = new URLSearchParams();
    const specialtyFilter = typeof options.specialty === 'string' ? options.specialty : specialty;
    const searchFilter = typeof options.search === 'string' ? options.search : doctorSearch;

    if (specialtyFilter.trim()) {
      query.set('specialty', specialtyFilter.trim());
    }
    if (searchFilter.trim()) {
      query.set('search', searchFilter.trim());
    }
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const data = await run(
      () => apiRequest(`/hospital/${id}/doctors${queryString}`, { method: 'GET' }, token),
      options.quiet ? '' : 'Doctors loaded'
    );

    if (data) {
      const items = data.doctors || [];
      if (data.hospital) {
        setSelectedHospitalDetails(data.hospital);
      }
      setDoctors(items);
      setDoctorId(items[0]?._id || '');
      setBooking((current) => ({
        ...current,
        appointmentDate: items[0]?.availabilitySlots?.[0]?.date || '',
      }));
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();

    const payload = {
      dateOfBirth: profile.dateOfBirth || undefined,
      gender: profile.gender,
      bloodGroup: profile.bloodGroup,
      address: profile.address,
      emergencyContactName: profile.emergencyContactName,
      emergencyContactPhone: profile.emergencyContactPhone,
      allergies: toList(profile.allergies),
      chronicConditions: toList(profile.chronicConditions),
    };

    const data = await run(
      () => apiRequest('/patient/me', { method: 'PUT', body: JSON.stringify(payload) }, token),
      'Profile saved'
    );

    if (data) loadOverview();
  };

  const bookAppointment = async (event) => {
    event.preventDefault();

    if (!hospitalId || !booking.appointmentDate || !booking.reason.trim()) {
      setStatus({ loading: false, error: 'Hospital, available date, and reason are required', message: '' });
      return;
    }

    if (!doctorId) {
      setStatus({ loading: false, error: 'Choose a doctor from this hospital before booking', message: '' });
      return;
    }

    if (!availableBookingDates.includes(booking.appointmentDate)) {
      setStatus({ loading: false, error: 'Choose one of the hospital availability dates', message: '' });
      return;
    }

    const basePayload = {
      hospitalId,
      appointmentDate: booking.appointmentDate,
      reason: booking.reason.trim(),
      notes: booking.notes.trim(),
    };

    const data = await run(
      () => apiRequest('/appointment/book-from-hospital', { method: 'POST', body: JSON.stringify({ ...basePayload, doctorId }) }, token),
      'Appointment booked'
    );

    if (data) {
      setBooking({ ...initialBooking, appointmentDate: availableBookingDates[0] || '' });
      loadOverview();
    }
  };

  const openReport = (reportId) => {
    if (reportId) {
      navigate(`/app/reports/${reportId}`);
    }
  };

  return (
    <div className="workspace-grid">
      <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'home' && (
        <div className="patient-home-screen">
          <section className="home-care-card">
            <div className="home-care-copy">
              <span>Upcoming appointment</span>
              {upcomingAppointment ? (
                <>
                  <strong>{upcomingAppointment.doctor?.user?.name || 'Doctor'}</strong>
                  <small>
                    {upcomingAppointment.hospitalId?.name || 'Independent clinic'} - Token #
                    {upcomingAppointment.queueNumber || '-'}
                  </small>
                  <small>{formatDateTime(upcomingAppointment.scheduledAt)}</small>
                </>
              ) : (
                <>
                  <strong>Book your next visit</strong>
                  <small>Search hospitals and choose an available doctor.</small>
                </>
              )}
              <button className="home-details-button" type="button" onClick={() => setActiveTab(upcomingAppointment ? 'appointments' : 'booking')}>
                {upcomingAppointment ? 'Details' : 'Find Doctor'}
              </button>
            </div>
            <div className="home-doctor-portrait" aria-hidden="true">
              {upcomingAppointment?.doctor?.user?.profileImage ? (
                <img src={getAssetUrl(upcomingAppointment.doctor.user.profileImage)} alt="" />
              ) : (
                <span>DR</span>
              )}
            </div>
          </section>

          <div className="quick-action-grid">
            <button type="button" className="quick-action-card" onClick={() => setActiveTab('history')}>
              <span className="quick-icon quick-icon-history" aria-hidden="true" />
              <strong>Health Records</strong>
            </button>
            <button type="button" className="quick-action-card" onClick={() => setActiveTab('history')}>
              <span className="quick-icon quick-icon-prescription" aria-hidden="true" />
              <strong>Prescriptions</strong>
            </button>
            <button type="button" className="quick-action-card" onClick={() => setActiveTab('history')}>
              <span className="quick-icon quick-icon-lab" aria-hidden="true" />
              <strong>Lab Results</strong>
            </button>
            <button type="button" className="quick-action-card" onClick={() => setActiveTab('appointments')}>
              <span className="quick-icon quick-icon-billing" aria-hidden="true" />
              <strong>Appointments</strong>
            </button>
          </div>

          <section className="mobile-list-section">
            <div className="mobile-section-title">
              <h3>Past Visits</h3>
              <button type="button" onClick={() => setActiveTab('history')}>View all</button>
            </div>
            <div className="mobile-card-list">
              {recentVisits.length === 0 ? (
                <EmptyState title="No past visits yet" description="Completed appointments will appear here." />
              ) : (
                recentVisits.map((item) => (
                  <article key={item.appointmentId} className="mobile-visit-item">
                    <div className="avatar avatar-mini">{(item.doctor?.name || 'D')[0]}</div>
                    <div>
                      <strong>{item.doctor?.name || 'Doctor'}</strong>
                      <small>{item.report?.diagnosis || item.status}</small>
                    </div>
                    <time>{formatDateTime(item.date)}</time>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'profile' && (
        <SectionCard title="Patient Profile" description="Keep your health basics ready before booking.">
          <form className="form-grid two-column" onSubmit={saveProfile}>
            <Field label="Date of Birth">
              <input name="dateOfBirth" type="date" value={profile.dateOfBirth} onChange={setField(setProfile)} />
            </Field>
            <Field label="Gender">
              <select name="gender" value={profile.gender} onChange={setField(setProfile)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Blood Group">
              <select name="bloodGroup" value={profile.bloodGroup} onChange={setField(setProfile)}>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </Field>
            <Field label="Address">
              <input name="address" value={profile.address} onChange={setField(setProfile)} placeholder="City, ward, street" />
            </Field>
            <Field label="Emergency Contact Name">
              <input name="emergencyContactName" value={profile.emergencyContactName} onChange={setField(setProfile)} />
            </Field>
            <Field label="Emergency Contact Phone">
              <input name="emergencyContactPhone" value={profile.emergencyContactPhone} onChange={setField(setProfile)} />
            </Field>
            <Field label="Allergies">
              <input name="allergies" value={profile.allergies} onChange={setField(setProfile)} placeholder="dust, penicillin" />
            </Field>
            <Field label="Chronic Conditions">
              <input name="chronicConditions" value={profile.chronicConditions} onChange={setField(setProfile)} placeholder="diabetes, asthma" />
            </Field>
            <div className="form-footer">
              <button className="primary-action" disabled={status.loading}>Save Profile</button>
            </div>
          </form>
        </SectionCard>
      )}

      {activeTab === 'booking' && (
        <>
          <SectionCard title="Hospital List" description="Browse hospitals, then open details to see doctors and book.">
            <form className="form-grid two-column" onSubmit={searchHospitals}>
              <Field label="Search Hospitals">
                <input value={hospitalSearch} onChange={(event) => setHospitalSearch(event.target.value)} placeholder="Hospital name, address, phone" />
              </Field>
              <div className="form-footer">
                <button className="secondary-action" disabled={status.loading}>Search Hospitals</button>
              </div>
            </form>
            <div className="hospital-directory-grid">
              {hospitals.length === 0 ? (
                <EmptyState title="No hospitals available" />
              ) : (
                hospitals.map((hospital) => {
                  const hospitalImage = getHospitalImage(hospital);
                  return (
                  <article
                    key={hospital._id}
                    className={`hospital-directory-card ${hospitalId === hospital._id ? 'selected' : ''}`}
                  >
                    <div className="hospital-card-media">
                      {hospitalImage ? (
                        <img src={getAssetUrl(hospitalImage)} alt="" />
                      ) : (
                        <div className="hospital-image-fallback">{hospital.name?.slice(0, 1) || 'H'}</div>
                      )}
                    </div>
                    <div className="hospital-card-body">
                      <strong>{hospital.name}</strong>
                      <span>{hospital.address || 'Address not set'}</span>
                      <small>{hospital.phone || hospital.email || 'Contact not set'}</small>
                      <button
                        className="primary-action compact-button"
                        type="button"
                        onClick={() => openHospitalDetails(hospital._id)}
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                  );
                })
              )}
            </div>
          </SectionCard>

        </>
      )}

      {activeTab === 'appointments' && (
        <SectionCard title="My Appointments" description="Track appointment status and token numbers.">
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
              onClick={() => setAppointmentFilters({ status: 'all', date: '', doctor: 'all', hospital: 'all' })}
            >
              Clear
            </button>
          </div>

          <div className="date-group-stack">
            {appointments.length === 0 ? (
              <EmptyState title="No appointments yet" description="Book an appointment to see it here." />
            ) : appointmentGroups.length === 0 ? (
              <EmptyState title="No appointments match your filters" description="Clear filters or choose another date/status." />
            ) : (
              appointmentGroups.map((group) => (
                <section key={group.date} className="date-group">
                  <h4>{formatDateGroup(group.date)}</h4>
                  <div className="list-stack">
                    {group.items.map((appointment) => (
                      <article key={appointment._id} className="appointment-card">
                        <div>
                          <strong>{appointment.doctor?.user?.name || 'Doctor'}</strong>
                          <p>{appointment.hospitalId?.name || 'Independent clinic'} - Token #{appointment.queueNumber}</p>
                        </div>
                        <div>
                          <StatusPill status={appointment.status} />
                          <small>{formatDateTime(appointment.scheduledAt)}</small>
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
        <SectionCard title="Doctor Chat" description="Search doctors and start a realtime conversation.">
          <ChatPanel />
        </SectionCard>
      )}

      {activeTab === 'history' && (
        <SectionCard title="Visit History" description="Open reports from the visit they belong to.">
          <div className="filter-bar">
            <Field label="Status">
              <select
                value={historyFilters.status}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, status: event.target.value }))}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No show</option>
              </select>
            </Field>
            <Field label="Report">
              <select
                value={historyFilters.report}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, report: event.target.value }))}
              >
                <option value="all">All records</option>
                <option value="with">With report</option>
                <option value="without">No report</option>
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={historyFilters.date}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, date: event.target.value }))}
              />
            </Field>
            <Field label="Doctor">
              <select
                value={historyFilters.doctor}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, doctor: event.target.value }))}
              >
                <option value="all">All doctors</option>
                {historyDoctorOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Hospital">
              <select
                value={historyFilters.hospital}
                onChange={(event) => setHistoryFilters((current) => ({ ...current, hospital: event.target.value }))}
              >
                <option value="all">All hospitals</option>
                {historyHospitalOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <button
              className="secondary-action compact-button filter-clear-button"
              type="button"
              onClick={() => setHistoryFilters({ status: 'all', date: '', report: 'all', doctor: 'all', hospital: 'all' })}
            >
              Clear
            </button>
          </div>

          <div className="date-group-stack">
            {history.length === 0 ? (
              <EmptyState title="No visit history yet" description="Completed or past appointments will appear here." />
            ) : historyGroups.length === 0 ? (
              <EmptyState title="No records match your filters" description="Clear filters or choose another date/status." />
            ) : (
              historyGroups.map((group) => (
                <section key={group.date} className="date-group">
                  <h4>{formatDateGroup(group.date)}</h4>
                  <div className="list-stack">
                    {group.items.map((item) => (
                      <article key={item.appointmentId} className="appointment-card appointment-card-expanded">
                        <div>
                          <strong>{item.doctor?.name || 'Doctor'}</strong>
                          <p>{item.hospital?.name || 'Independent clinic'} - {formatDateTime(item.date)}</p>
                          <small>{item.report ? `Report: ${item.report.diagnosis}` : 'No report attached yet'}</small>
                        </div>
                        <div className="appointment-actions">
                          <StatusPill status={item.status} />
                          {item.report && (
                            <button
                              className="secondary-action compact-button"
                              type="button"
                              onClick={() => openReport(item.report.id)}
                            >
                              View Report
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

      <Notice error={status.error} message={status.message} />
    </div>
  );
}
