import { useState } from "react";

const getResultMessage = (result) => {
  if (!result) return "";
  if (typeof result.message === "string") return result.message;
  if (result.user?.name) return `${result.user.name} saved successfully`;
  if (result.hospital?.name) return `${result.hospital.name} saved successfully`;
  if (result.doctor?.user?.name) return `${result.doctor.user.name} saved successfully`;
  return "Action completed successfully";
};

const getResultStats = (result) => {
  if (!result || typeof result !== "object") return [];

  return Object.entries(result)
    .filter(([, value]) => Array.isArray(value))
    .map(([key, value]) => ({
      label: key.replace(/([A-Z])/g, " $1"),
      value: value.length,
    }));
};

export function ApiCard({
  title,
  description,
  endpoint,
  defaultPayload,
  pathFields = [],
  buildPath,
  onSubmit,
}) {
  const [payloadText, setPayloadText] = useState(
    defaultPayload ? JSON.stringify(defaultPayload, null, 2) : "",
  );
  const [fieldValues, setFieldValues] = useState(() =>
    pathFields.reduce((values, field) => {
      values[field.name] = field.defaultValue || "";
      return values;
    }, {}),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleRun = async () => {
    setError("");
    setResult(null);

    const missingField = pathFields.find(
      (field) =>
        field.required !== false &&
        !String(fieldValues[field.name] || "").trim(),
    );

    if (missingField) {
      setError(`${missingField.label} is required`);
      return;
    }

    let payload = undefined;
    if (payloadText?.trim()) {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setError("Invalid JSON payload");
        return;
      }
    }

    try {
      setLoading(true);
      const path = buildPath ? buildPath(fieldValues) : endpoint;
      const data = await onSubmit({ path, payload, fields: fieldValues });
      setResult(data);
    } catch (err) {
      setError(err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="action-card">
      <div className="action-card-header">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>

      {pathFields.length > 0 && (
        <div className="form-grid compact-grid">
          {pathFields.map((field) => (
            <label key={field.name} className="input-group">
              <span>{field.label}</span>
              <input
                value={fieldValues[field.name] || ""}
                placeholder={field.placeholder || ""}
                onChange={(event) =>
                  setFieldValues((current) => ({
                    ...current,
                    [field.name]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
      )}

      {defaultPayload !== null && (
        <label className="input-group">
          <span>Details</span>
          <textarea
            rows={7}
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
          />
        </label>
      )}

      <button className="primary-action" onClick={handleRun} disabled={loading}>
        {loading ? "Working..." : "Run Action"}
      </button>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="action-result">
          <strong>{getResultMessage(result)}</strong>
          {getResultStats(result).length > 0 && (
            <div className="result-metrics">
              {getResultStats(result).map((item) => (
                <span key={item.label}>
                  {item.label}: <b>{item.value}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
