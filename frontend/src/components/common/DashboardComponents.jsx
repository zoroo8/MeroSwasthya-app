export function SectionCard({ title, description, actions, children, className = '' }) {
  return (
    <section className={`section-card ${className}`}>
      <div className="section-card-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="section-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Field({ label, children }) {
  return (
    <label className="input-group">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Notice({ error, message }) {
  if (!error && !message) return null;
  return (
    <div className={`notice ${error ? 'notice-error' : 'notice-success'}`} role={error ? 'alert' : 'status'}>
      <strong>{error ? 'Needs attention' : 'Done'}</strong>
      <span>{error || message}</span>
    </div>
  );
}

export function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  );
}

export function TabNav({ tabs, activeTab, onChange }) {
  return (
    <div className="tab-list" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
        >
          {tab.icon && <span className={`tab-icon tab-icon-${tab.icon}`} aria-hidden="true" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPill({ status }) {
  const label = String(status || 'unknown').replace('_', ' ');
  return <span className={`status-pill status-${status || 'default'}`}>{label}</span>;
}

export function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateList(values) {
  if (!Array.isArray(values) || values.length === 0) return 'No dates set';
  return values.map(formatDate).join(', ');
}

export function formatAvailabilitySlots(values) {
  if (!Array.isArray(values) || values.length === 0) return 'No availability set';
  return values
    .map((slot) => `${formatDate(slot.date)} (${slot.maxDailyBookings} patients)`)
    .join(', ');
}

export function getDateKey(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString().slice(0, 10);
}

export function formatDateGroup(key) {
  if (key === 'unknown') return 'Date not set';
  const date = new Date(`${key}T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function groupByDate(items, getValue, direction = 'desc') {
  const groupMap = new Map();

  items.forEach((item) => {
    const key = getDateKey(getValue(item));
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(item);
  });

  return [...groupMap.entries()]
    .sort(([a], [b]) => (direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)))
    .map(([date, groupItems]) => ({
      date,
      items: groupItems
        .slice()
        .sort((a, b) => {
          const first = new Date(getValue(a) || 0).getTime();
          const second = new Date(getValue(b) || 0).getTime();
          return direction === 'asc' ? first - second : second - first;
        }),
    }));
}

export function toDateTimeLocal(daysFromNow = 1, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
