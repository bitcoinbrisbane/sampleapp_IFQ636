import axios from 'axios';

// In production the React build is served by Nginx on the same origin, and Nginx
// reverse-proxies /api -> Node on :5001, so an empty baseURL (same-origin) is correct.
// In development the CRA dev server runs on :3000 and talks to the backend on :5001.
// Override either with REACT_APP_API_URL at build time if needed.
const baseURL =
  process.env.REACT_APP_API_URL ??
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001');

const axiosInstance = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

export default axiosInstance;
