import axios from 'axios';
import { getToken } from '@/lib/session';

// IMPORTANT: for the APK this must be your permanent HTTPS backend URL (e.g. Render), not ngrok.
export const API_URL = 'https://ripping-scuff-mutiny.ngrok-free.dev/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'https://yammy-bites.onrender.com' },
  timeout: 20000,
});

// Attach the backend JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function errorMessage(e: any, fallback = 'Something went wrong') {
  return e?.response?.data?.error || e?.message || fallback;
}
