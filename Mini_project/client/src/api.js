import axios from 'axios';
import { getAuth, clearAuth } from './auth/storage';

// ONE place for all server calls:  import api from '../api';  api.get('/proposals')
const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request (SCP-F-001, SCP-SR-002).
api.interceptors.request.use((config) => {
  const auth = getAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// If the token is missing, wrong or expired (8 hours), send the user to login.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginCall = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginCall) {
      clearAuth();
      window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
