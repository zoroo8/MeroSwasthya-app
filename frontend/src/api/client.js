const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

const getFriendlyErrorMessage = (message) => {
  if (!message) return 'Request failed';
  if (/gmail|smtp|badcredentials|username and password not accepted/i.test(message)) {
    return 'Verification email could not be sent. Please check the server email settings.';
  }
  return message;
};

export async function apiRequest(path, options = {}, token) {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(getFriendlyErrorMessage(data.message));
  }

  return data;
}

export function getAssetUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const apiRoot = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${apiRoot}${value.startsWith('/') ? value : `/${value}`}`;
}

export { API_BASE_URL, SOCKET_BASE_URL };
