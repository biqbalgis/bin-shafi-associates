import axios from "axios";

const ACCESS_TOKEN_KEY = "aviation_fuel_access";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api",
});

export function setAccessToken(token: string | null) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function unwrapListResponse<T>(payload: { results?: T[] } | T[]) {
  return Array.isArray(payload) ? payload : payload.results ?? [];
}

export const storageKeys = {
  access: ACCESS_TOKEN_KEY,
  refresh: "aviation_fuel_refresh",
  user: "aviation_fuel_user",
};
