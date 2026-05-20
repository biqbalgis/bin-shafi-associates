import { apiClient } from "./http";
import type { ClientPaymentMethod, ClientStatement } from "../types";

export async function getClientStatement(clientId: number) {
  const response = await apiClient.get<ClientStatement>(`/clients/${clientId}/statement/`);
  return response.data;
}

export async function createClientPayment(payload: {
  client: number;
  order: number;
  amount: string;
  date: string;
  payment_method: ClientPaymentMethod;
  reference: string;
  notes?: string;
}) {
  const response = await apiClient.post("/client-payments/", {
    ...payload,
    amount: payload.amount.trim(),
    reference: payload.reference.trim(),
    notes: (payload.notes ?? "").trim(),
  });
  return response.data;
}

export async function createBulkClientPayment(payload: {
  client: number;
  amount: string;
  date: string;
  payment_method: ClientPaymentMethod;
  reference: string;
}) {
  const response = await apiClient.post("/client-payments/bulk/", {
    ...payload,
    amount: payload.amount.trim(),
    reference: payload.reference.trim(),
  });
  return response.data;
}
