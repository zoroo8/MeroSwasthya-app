import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest, getAssetUrl } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import {
  EmptyState,
  Field,
  Notice,
  SectionCard,
  StatusPill,
  formatAvailabilitySlots,
  formatDateTime,
} from '../../components/common/DashboardComponents';

const initialBooking = {
  appointmentDate: '',
  reason: '',
  notes: '',
};

const getHospitalImage = (hospital) => hospital?.bannerImage || hospital?.adminUser?.profileImage || '';

const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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

function BookingDateCalendar({ slots, value, onChange }) {
  const availableDates = useMemo(() => slots.map((slot) => slot.date), [slots]);
  const availableKey = availableDates.join('|');
  const slotMap = useMemo(() => new Map(slots.map((slot) => [slot.date, slot])), [slots]);
  const [month, setMonth] = useState(() => {
    const firstDate = value || availableDates[0];
    const initialDate = firstDate ? new Date(`${firstDate}T00:00:00`) : new Date();
    return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1);
  });

  useEffect(() => {
    const focusDate = value || availableDates[0];
    if (!focusDate) return;
    const nextMonth = new Date(`${focusDate}T00:00:00`);
    setMonth(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1));
  }, [value, availableKey]);

  const selectedSlot = slotMap.get(value);

  return (
    <div className="availability-calendar booking-date-calendar">
      <div className="calendar-toolbar">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          {'<'}
        </button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
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
          const available = slotMap.has(key);
          return (
            <button
              key={key}
              type="button"
              className={`calendar-day ${available ? 'available' : ''} ${value === key ? 'selected' : ''}`}
              disabled={!available}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
            >
              {cell.day.getDate()}
            </button>
          );
        })}
      </div>
      <small className="calendar-selection-note">
        {selectedSlot ? `${selectedSlot.date} - ${selectedSlot.maxDailyBookings} patient limit` : 'No available date selected.'}
      </small>
    </div>
  );
}

export function PatientHospitalDetailsPage() {
  const { hospitalId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [booking, setBooking] = useState(initialBooking);
  const [status, setStatus] = useState({ loading: false, error: '', message: '' });

  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => doctor._id === doctorId),
    [doctors, doctorId]
  );

  const hospitalAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) => String(appointment.hospitalId?._id || appointment.hospitalId) === String(hospitalId)
      ),
    [appointments, hospitalId]
  );

  const pendingHospitalAppointments = useMemo(
    () => hospitalAppointments.filter((appointment) => appointment.status === 'pending'),
    [hospitalAppointments]
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

  const availableBookingDates = useMemo(
    () => availableBookingSlots.map((slot) => slot.date),
    [availableBookingSlots]
  );

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

  const loadDetails = async (options = {}) => {
    const query = new URLSearchParams();
    const specialtyFilter = typeof options.specialty === 'string' ? options.specialty : specialty;
    const searchFilter = typeof options.search === 'string' ? options.search : doctorSearch;

    if (specialtyFilter.trim()) query.set('specialty', specialtyFilter.trim());
    if (searchFilter.trim()) query.set('search', searchFilter.trim());

    const queryString = query.toString() ? `?${query.toString()}` : '';

    const data = await run(
      () => apiRequest(`/hospital/${hospitalId}/doctors${queryString}`, { method: 'GET' }, token),
      ''
    );

    if (data) {
      const items = data.doctors || [];
      setHospital(data.hospital || null);
      setDoctors(items);
      setDoctorId((current) => (items.some((doctor) => doctor._id === current) ? current : items[0]?._id || ''));
      setBooking((current) => ({
        ...current,
        appointmentDate: items[0]?.availabilitySlots?.[0]?.date || current.appointmentDate || '',
      }));
    }
  };

  const loadAppointments = async () => {
    const data = await run(() => apiRequest('/appointment/my', { method: 'GET' }, token), '');
    if (data) setAppointments(data.appointments || []);
  };

  useEffect(() => {
    if (token && hospitalId) {
      loadDetails({ search: '', specialty: '' });
      loadAppointments();
    }
  }, [token, hospitalId]);

  useEffect(() => {
    setBooking((current) => {
      if (availableBookingDates.includes(current.appointmentDate)) return current;
      return { ...current, appointmentDate: availableBookingDates[0] || '' };
    });
  }, [availableBookingDateKey]);

  const bookAppointment = async (event) => {
    event.preventDefault();

    if (!hospitalId || !booking.appointmentDate || !booking.reason.trim()) {
      setStatus({ loading: false, error: 'Hospital, available date, and reason are required', message: '' });
      return;
    }

    if (!doctorId) {
      setStatus({ loading: false, error: 'Choose a doctor before booking', message: '' });
      return;
    }

    if (!availableBookingDates.includes(booking.appointmentDate)) {
      setStatus({ loading: false, error: 'Choose one of the available dates', message: '' });
      return;
    }

    const data = await run(
      () =>
        apiRequest(
          '/appointment/book-from-hospital',
          {
            method: 'POST',
            body: JSON.stringify({
              hospitalId,
              doctorId,
              appointmentDate: booking.appointmentDate,
              reason: booking.reason.trim(),
              notes: booking.notes.trim(),
            }),
          },
          token
        ),
      'Appointment booked'
    );

    if (data) {
      setBooking({ ...initialBooking, appointmentDate: availableBookingDates[0] || '' });
      loadAppointments();
    }
  };

  return (
    <div className="workspace-grid details-page">
      <SectionCard
        title={hospital ? hospital.name : 'Hospital details'}
        description="Choose a doctor, check availability, and book your appointment."
        actions={
          <button className="secondary-action compact-button" type="button" onClick={() => navigate('/app')}>
            Back to Hospitals
          </button>
        }
      >
        {hospital ? (
          <div className="hospital-detail-hero details-hero">
            <div className="hospital-detail-media">
              {getHospitalImage(hospital) ? (
                <img src={getAssetUrl(getHospitalImage(hospital))} alt="" />
              ) : (
                <div className="hospital-image-fallback large">{hospital.name?.slice(0, 1) || 'H'}</div>
              )}
            </div>
            <div className="hospital-detail-info">
              <span>Hospital</span>
              <strong>{hospital.name}</strong>
              <p>{hospital.address || 'Address not set'}</p>
              <small>{hospital.phone || hospital.email || 'Contact not set'}</small>
              <div className="detail-stat-row">
                <div>
                  <span>Doctors</span>
                  <strong>{doctors.length}</strong>
                </div>
                <div>
                  <span>Pending Appointments</span>
                  <strong>{pendingHospitalAppointments.length}</strong>
                </div>
                <div>
                  <span>Next Slot</span>
                  <strong>{availableBookingDates[0] || 'None'}</strong>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState title="Loading hospital" description="Hospital details will appear here." />
        )}
      </SectionCard>

      <div className="hospital-detail-grid">
        <SectionCard title="Doctors" description="Filter doctors and select one before booking.">
          <form
            className="form-grid two-column"
            onSubmit={(event) => {
              event.preventDefault();
              loadDetails();
            }}
          >
            <Field label="Doctor Name">
              <input value={doctorSearch} onChange={(event) => setDoctorSearch(event.target.value)} placeholder="Search by doctor name" />
            </Field>
            <Field label="Specialty">
              <input value={specialty} onChange={(event) => setSpecialty(event.target.value)} placeholder="Cardiology, Dermatology..." />
            </Field>
            <div className="form-footer">
              <button className="secondary-action" disabled={status.loading}>Search Doctors</button>
            </div>
          </form>

          <div className="doctor-grid">
            {doctors.length === 0 ? (
              <EmptyState title="No doctors available" description="This hospital has no matching approved doctors yet." />
            ) : (
              doctors.map((doctor) => (
                <button
                  type="button"
                  key={doctor._id}
                  className={`select-card doctor-select-card ${doctorId === doctor._id ? 'selected' : ''}`}
                  onClick={() => {
                    setDoctorId(doctor._id);
                    setBooking((current) => ({ ...current, appointmentDate: doctor.availabilitySlots?.[0]?.date || '' }));
                  }}
                >
                  <div className="doctor-card-title">
                    {doctor.user?.profileImage ? (
                      <img className="avatar" src={getAssetUrl(doctor.user.profileImage)} alt="" />
                    ) : (
                      <div className="avatar">{(doctor.user?.name || 'D')[0]}</div>
                    )}
                    <strong>{doctor.user?.name || 'Doctor'}</strong>
                  </div>
                  <span>{doctor.specialty}</span>
                  <small>{doctor.experienceYears || 0} years experience</small>
                  <small>{formatAvailabilitySlots(doctor.availabilitySlots)}</small>
                </button>
              ))
            )}
          </div>
        </SectionCard>

        <form className="booking-panel" onSubmit={bookAppointment}>
          <div className="booking-summary">
            <span>Book appointment</span>
            <strong>{selectedDoctor?.user?.name || 'Choose a doctor'}</strong>
            <small>{selectedDoctor ? selectedDoctor.specialty : 'Select a doctor from the list.'}</small>
          </div>
          <Field label="Doctor">
            <select
              value={doctorId}
              onChange={(event) => {
                const nextDoctor = doctors.find((doctor) => doctor._id === event.target.value);
                setDoctorId(event.target.value);
                setBooking((current) => ({ ...current, appointmentDate: nextDoctor?.availabilitySlots?.[0]?.date || '' }));
              }}
            >
              <option value="">Choose doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.user?.name || 'Doctor'} - {doctor.specialty}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Available Date">
            <BookingDateCalendar
              slots={availableBookingSlots}
              value={booking.appointmentDate}
              onChange={(appointmentDate) => setBooking((current) => ({ ...current, appointmentDate }))}
            />
          </Field>
          <Field label="Reason">
            <input name="reason" value={booking.reason} onChange={setField(setBooking)} placeholder="General checkup, fever, follow-up..." />
          </Field>
          <Field label="Notes">
            <textarea name="notes" rows={4} value={booking.notes} onChange={setField(setBooking)} placeholder="Optional symptoms or notes" />
          </Field>
          <button className="primary-action" disabled={status.loading || !doctorId || availableBookingDates.length === 0}>
            Book Appointment
          </button>
        </form>
      </div>

      <SectionCard title="Pending appointments here" description="Only pending appointments at this hospital are shown here.">
        <div className="list-stack">
          {pendingHospitalAppointments.length === 0 ? (
            <EmptyState title="No pending appointments here" description="New appointment requests for this hospital will appear here." />
          ) : (
            pendingHospitalAppointments.map((appointment) => (
              <article key={appointment._id} className="appointment-card">
                <div>
                  <strong>{appointment.doctor?.user?.name || 'Doctor'}</strong>
                  <p>Token #{appointment.queueNumber} - {appointment.reason}</p>
                </div>
                <div>
                  <StatusPill status={appointment.status} />
                  <small>{formatDateTime(appointment.scheduledAt)}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </SectionCard>

      <Notice error={status.error} message={status.message} />
    </div>
  );
}
