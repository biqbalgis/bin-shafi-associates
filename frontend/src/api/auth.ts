import { apiClient } from "./http";
import type { LoginResponse, User } from "../types";

export async function loginRequest(username: string, password: string) {
  const response = await apiClient.post<LoginResponse>("/auth/login/", { username, password });
  return response.data;
}

export async function getCurrentUser() {
  const response = await apiClient.get<User>("/auth/me/");
  return response.data;
}
