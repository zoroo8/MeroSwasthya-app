import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiRequest } from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import {
  EmptyState,
  Notice,
  SectionCard,
  StatusPill,
  formatDateTime,
} from '../../components/common/DashboardComponents';

const valueList = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export function ReportDetailsPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '', message: '' });

  useEffect(() => {
    let isMounted = true;

    const loadReport = async () => {
      setStatus({ loading: true, error: '', message: '' });
      try {
        const data = await apiRequest(`/report/${reportId}`, { method: 'GET' }, token);
        if (!isMounted) return;
        setReport(data.report);
        setStatus({ loading: false, error: '', message: '' });
      } catch (err) {
        if (!isMounted) return;
        setStatus({ loading: false, error: err.message || 'Unable to load report', message: '' });
      }
    };

    if (token && reportId) {
      loadReport();
    }

    return () => {
      isMounted = false;
    };
  }, [token, reportId]);

  return (
    <div className="workspace-grid details-page">
      <SectionCard
        title="Medical Report"
        description="Review prescription, tests, follow-up date, and notes."
        actions={
          <div className="inline-actions report-page-actions">
            <button className="secondary-action compact-button" type="button" onClick={() => navigate('/app')}>
              Back to Records
            </button>
            <button className="primary-action compact-button" type="button" onClick={() => window.print()}>
              Print Report
            </button>
          </div>
        }
      >
        {status.loading ? (
          <EmptyState title="Loading report" description="Report details will appear here." />
        ) : report ? (
          <article className={`report-document ${report.appointment?.status === 'completed' ? 'report-completed' : ''}`}>
            {report.appointment?.status === 'completed' && <span className="report-watermark">Completed</span>}
            <header className="report-letterhead">
              <div className="report-letterhead-brand">
                <div className="report-letterhead-mark" aria-hidden="true">M</div>
                <div>
                  <span>Medical Report</span>
                  <h2>{report.hospitalId?.name || 'MeroSwasthya Clinic'}</h2>
                  <p>{report.hospitalId?.address || 'Independent clinical record'}</p>
                </div>
              </div>
              <div className="report-letterhead-meta">
                <strong>Report #{String(report.id || report._id || reportId).slice(-8)}</strong>
                <span>{formatDateTime(report.createdAt || report.appointment?.scheduledAt)}</span>
                {report.appointment?.status && <StatusPill status={report.appointment.status} />}
              </div>
            </header>

            <section className="report-party-grid">
              <div>
                <span>Patient</span>
                <strong>{report.patientUser?.name || 'Patient'}</strong>
                <p>ID {report.patientUser?._id || report.patientUser?.id || 'Not available'}</p>
                <small>{report.patientUser?.email || report.patientUser?.phone || 'Contact not listed'}</small>
              </div>
              <div>
                <span>Doctor</span>
                <strong>{report.doctor?.user?.name || 'Doctor'}</strong>
                <p>{report.doctor?.specialty || 'Specialty not listed'}</p>
                <small>License {report.doctor?.licenseNumber || 'Not listed'}</small>
              </div>
              <div>
                <span>Visit</span>
                <strong>{formatDateTime(report.appointment?.scheduledAt || report.createdAt)}</strong>
                <p>Token #{report.appointment?.queueNumber || 'Not set'}</p>
                <small>{report.appointment?.reason || 'Visit reason not listed'}</small>
              </div>
            </section>

            <section className="report-clinical-section report-diagnosis-section">
              <span>Diagnosis</span>
              <h3>{report.diagnosis || 'Diagnosis not listed'}</h3>
            </section>

            <section className="report-clinical-section">
              <div className="report-section-heading">
                <h3>Prescription</h3>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Medicine or Instruction</th>
                  </tr>
                </thead>
                <tbody>
                  {valueList(report.prescription).length === 0 ? (
                    <tr><td colSpan="2">No prescription listed.</td></tr>
                  ) : (
                    valueList(report.prescription).map((item, index) => (
                      <tr key={item}>
                        <td>{index + 1}</td>
                        <td>{item}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="report-clinical-section">
              <div className="report-section-heading">
                <h3>Recommended Tests</h3>
              </div>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Test</th>
                  </tr>
                </thead>
                <tbody>
                  {valueList(report.testRecommendations).length === 0 ? (
                    <tr><td colSpan="2">No tests recommended.</td></tr>
                  ) : (
                    valueList(report.testRecommendations).map((item, index) => (
                      <tr key={item}>
                        <td>{index + 1}</td>
                        <td>{item}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>

            <section className="report-follow-up-grid">
              <div className="report-clinical-section">
                <span>Follow-up</span>
                <p>{report.followUpDate ? formatDateTime(report.followUpDate) : 'Not set'}</p>
              </div>
              <div className="report-clinical-section">
                <span>Clinical Notes</span>
                <p>{report.notes || 'No notes added.'}</p>
              </div>
            </section>

            {valueList(report.attachments).length > 0 && (
              <section className="report-clinical-section">
                <span>Attachments</span>
                <div className="attachment-list">
                  {valueList(report.attachments).map((item) => (
                    <a key={item} href={item} target="_blank" rel="noreferrer">{item}</a>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : (
          <EmptyState title="Report not found" description="This report could not be loaded." />
        )}
      </SectionCard>

      <Notice error={status.error} message={status.message} />
    </div>
  );
}
