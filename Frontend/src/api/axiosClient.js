import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/api';

let accessToken = null;
let refreshPromise = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

const axiosClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const refreshClient = axios.create({ baseURL, withCredentials: true });

axiosClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

const isPublicPath = () => {
  const path = window.location.pathname;
  return (
    path === '/login' ||
    path === '/register' ||
    path === '/forgot-password' ||
    path.startsWith('/reset-password/')
  );
};

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original?._retried && !isPublicPath()) {
      original._retried = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
          });
        }
        const { data } = await refreshPromise;
        accessToken = data.accessToken;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return axiosClient(original);
      } catch {
        accessToken = null;
        if (!isPublicPath()) window.location.assign('/login');
      }
    }

    if (!error.response) {
      error.message = navigator.onLine
        ? "Can't reach the SConnect server right now. Please try again in a moment."
        : "You're offline. Check your connection and try again.";
    }

    return Promise.reject(error);
  }
);

export const errorMessage = (error) => {
  const data = error.response?.data;
  if (typeof data === 'string') return data;
  if (data?.error) return data.error;
  if (data?.message) return data.message;
  return error.message || 'Something went wrong';
};

export default axiosClient;
