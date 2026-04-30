import { apiClient, unwrapListResponse } from "./http";
import type { ListResponse, User, UserRole } from "../types";

export type UserManagementPayload = {
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  password: string;
  password_confirm: string;
  role: UserRole;
  client?: number | null;
  is_active?: boolean;
};

export type UserManagementUpdatePayload = {
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  password_confirm?: string;
  role?: UserRole;
  client?: number | null;
  is_active?: boolean;
};

export async function listUsers() {
  const response = await apiClient.get<ListResponse<User>>("/users/");
  return unwrapListResponse(response.data);
}

export async function createUser(payload: UserManagementPayload) {
  const response = await apiClient.post<User>("/users/", payload);
  return response.data;
}

export async function updateUser(userId: number, payload: UserManagementUpdatePayload) {
  const response = await apiClient.patch<User>(`/users/${userId}/`, payload);
  return response.data;
}
