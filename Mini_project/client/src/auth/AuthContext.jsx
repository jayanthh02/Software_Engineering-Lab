import { createContext, useContext, useState } from 'react';
import api from '../api';
import { getAuth, setAuth, clearAuth } from './storage';

const AuthContext = createContext(null);

// Use anywhere:  const { user, login, logout } = useAuth();
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [auth, setAuthState] = useState(() => getAuth());

  // Throws if the server answers 400 / 401, so the login page can show the message.
  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    setAuth(res.data); // { token, user }
    setAuthState(res.data);
    return res.data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      /* even if this fails, the token is discarded below */
    }
    clearAuth();
    setAuthState(null);
  }

  const value = { user: auth?.user || null, token: auth?.token || null, login, logout };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
