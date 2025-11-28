import { createContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'hms_auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { token: '', user: null };
    } catch {
      return { token: '', user: null };
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      isAuthenticated: Boolean(auth.token && auth.user),
      login: ({ token, user }) => setAuth({ token, user }),
      logout: () => setAuth({ token: '', user: null }),
      setUser: (user) => setAuth((prev) => ({ ...prev, user })),
    }),
    [auth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}