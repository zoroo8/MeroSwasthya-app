import { Link } from 'react-router-dom';
import testimonialCoordinator from '../assets/testimonial-coordinator.jpg';
import testimonialDoctor from '../assets/testimonial-doctor.jpg';
import testimonialPatient from '../assets/testimonial-patient.jpg';

const roleCards = [
  {
    title: 'Patients',
    text: 'Find hospitals, book appointments, chat with doctors, and review visit history.',
  },
  {
    title: 'Doctors',
    text: 'Manage clinical profiles, appointment status, patient conversations, and reports.',
  },
  {
    title: 'Hospitals',
    text: 'Coordinate doctors, availability, appointments, and hospital-linked reports.',
  },
  {
    title: 'Admins',
    text: 'Oversee users, hospitals, approvals, and system-wide medical records.',
  },
];

const testimonials = [
  {
    quote: 'Appointment booking feels clear for patients, and our front desk can see hospital schedules without calling every department.',
    name: 'Anita Shrestha',
    role: 'Hospital Coordinator',
    image: testimonialCoordinator,
  },
  {
    quote: 'The visit history and report flow keeps clinical notes connected to the exact appointment, which makes follow-up much easier.',
    name: 'Dr. Samir K.C.',
    role: 'Consultant Physician',
    image: testimonialDoctor,
  },
  {
    quote: 'I can find a hospital, pick a doctor, and keep my reports in one place. It feels simple even when I am in a hurry.',
    name: 'Rajan Thapa',
    role: 'Patient',
    image: testimonialPatient,
  },
];

export function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <nav className="landing-nav" aria-label="Landing navigation">
          <Link className="landing-brand" to="/">
            <span>M</span>
            <strong>MeroSwasthya</strong>
          </Link>
          <div className="landing-nav-actions">
            <Link to="/login">Login</Link>
            <Link className="landing-nav-cta" to="/register">Get Started</Link>
          </div>
        </nav>

        <div className="landing-hero-content">
          <p className="eyebrow">Hospital Management System</p>
          <h1>MeroSwasthya</h1>
          <p>
            A connected care workspace for appointments, doctor availability,
            secure conversations, and medical reports.
          </p>
          <div className="landing-actions">
            <Link className="primary-action" to="/register">Get Started</Link>
            <Link className="secondary-action" to="/login">Open Workspace</Link>
          </div>
        </div>
      </section>

      <section className="landing-band landing-band-overlap" aria-label="Platform highlights">
        <div className="landing-strip">
          <div>
            <span>Booking</span>
            <strong>Queue-aware appointments</strong>
          </div>
          <div>
            <span>Care Teams</span>
            <strong>Doctor and hospital workflows</strong>
          </div>
          <div>
            <span>Records</span>
            <strong>Reports tied to visits</strong>
          </div>
        </div>
      </section>

      <section className="landing-band landing-band-white">
        <div className="landing-section">
          <div className="landing-section-heading">
            <p className="eyebrow">One System</p>
            <h2>Built around each care role</h2>
          </div>
          <div className="landing-role-grid">
            {roleCards.map((card) => (
              <article key={card.title} className="landing-role-card">
                <strong>{card.title}</strong>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band landing-band-soft">
        <div className="landing-testimonials">
          <div className="landing-section-heading">
            <p className="eyebrow">Testimonials</p>
            <h2>Trusted by care teams and patients</h2>
          </div>
          <div className="testimonial-grid">
            {testimonials.map((item) => (
              <article key={item.name} className="testimonial-card">
                <p>{item.quote}</p>
                <div className="testimonial-person">
                  <img src={item.image} alt="" />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.role}</small>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-band landing-band-white">
        <div className="landing-cta">
          <div>
            <p className="eyebrow">Ready for Better Care Flow?</p>
            <h2>Start managing appointments, doctors, chats, and reports from one clean workspace.</h2>
          </div>
          <Link className="primary-action" to="/register">Get Started</Link>
        </div>
      </section>
    </main>
  );
}
