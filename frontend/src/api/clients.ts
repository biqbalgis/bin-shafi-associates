import { apiClient } from "./http";
import type { ClientStatement } from "../types";

export async function getClientStatement(clientId: number) {
  const response = await apiClient.get<ClientStatement>(`/clients/${clientId}/statement/`);
  return response.data;
}
