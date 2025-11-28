import { useEffect, useMemo, useState } from 'react';
import { Field, formatDateTime } from './DashboardComponents';

export const splitReportItems = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const joinReportItems = (items) => items.join(', ');

export function TagListField({ label, value, onChange, placeholder }) {
  const tags = useMemo(() => splitReportItems(value), [value]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!value) setDraft('');
  }, [value]);

  const commitDraft = () => {
    const nextTags = splitReportItems(draft);
    if (nextTags.length === 0) return;

    onChange(joinReportItems([...new Set([...tags, ...nextTags])]));
    setDraft('');
  };

  const removeTag = (tag) => {
    onChange(joinReportItems(tags.filter((item) => item !== tag)));
  };

  return (
    <Field label={label}>
      <div className="tag-input-shell">
        {tags.length > 0 && (
          <div className="tag-token-list">
            {tags.map((tag) => (
              <span key={tag} className="tag-token">
                {tag}
                <button type="button" aria-label={`Remove ${tag}`} onClick={() => removeTag(tag)}>x</button>
              </span>
            ))}
          </div>
        )}
        <input
          value={draft}
          onBlur={commitDraft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault();
              commitDraft();
            }

            if (event.key === 'Backspace' && !draft && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder={placeholder}
        />
      </div>
    </Field>
  );
}

export function ReportDraftPreview({ form, appointment }) {
  const prescription = splitReportItems(form.prescription);
  const tests = splitReportItems(form.testRecommendations);

  return (
    <aside className="report-preview-document" aria-label="Report preview">
      <div className="report-preview-letterhead">
        <strong>{appointment?.hospitalId?.name || 'MeroSwasthya Medical Report'}</strong>
        <span>{appointment?.doctor?.user?.name || 'Doctor'} - {formatDateTime(appointment?.scheduledAt)}</span>
      </div>
      <div className="report-preview-facts">
        <span>Patient</span>
        <strong>{appointment?.patientUser?.name || 'Choose an appointment'}</strong>
        <span>Diagnosis</span>
        <strong>{form.diagnosis.trim() || 'Diagnosis pending'}</strong>
      </div>
      <section>
        <h4>Prescription</h4>
        {prescription.length === 0 ? (
          <p>No medicines listed.</p>
        ) : (
          <ol>{prescription.map((item) => <li key={item}>{item}</li>)}</ol>
        )}
      </section>
      <section>
        <h4>Tests</h4>
        {tests.length === 0 ? (
          <p>No tests recommended.</p>
        ) : (
          <div className="tag-token-list report-preview-tags">
            {tests.map((item) => <span key={item} className="tag-token static-tag">{item}</span>)}
          </div>
        )}
      </section>
      <div className="report-preview-follow-up">
        <span>Follow-up</span>
        <strong>{form.followUpDate || 'Not set'}</strong>
      </div>
      {form.notes.trim() && <p className="report-preview-notes">{form.notes.trim()}</p>}
    </aside>
  );
}
