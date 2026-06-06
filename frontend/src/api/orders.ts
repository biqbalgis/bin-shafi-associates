import { apiClient, unwrapListResponse } from "./http";
import type { FlightStatus, ListResponse, Order, OrderScope, OrderStatus, SavedEmailContact } from "../types";

export type OrderFilters = {
  search?: string;
  status?: OrderStatus | "";
  scope?: OrderScope;
  dateFrom?: string;
  dateTo?: string;
};

export type OrderPayload = {
  date: string;
  flight: string;
  flight_status: FlightStatus;
  client?: number;
  aircraft: number;
  airport: number;
  route: string;
  fuel_type: number;
  quantity_ltrs: string;
};

export type OrderUpdatePayload = {
  status?: OrderStatus;
  dr_no?: string;
  approval_email_to?: string;
  approval_email_cc?: string;
};

export async function listOrders(filters?: OrderFilters) {
  const response = await apiClient.get<ListResponse<Order>>("/orders/", {
    params: {
      search: filters?.search || undefined,
      status: filters?.status || undefined,
      scope: filters?.scope || undefined,
      date_from: filters?.dateFrom || undefined,
      date_to: filters?.dateTo || undefined,
    },
  });
  return unwrapListResponse(response.data);
}

export async function getOrder(orderId: number) {
  const response = await apiClient.get<Order>(`/orders/${orderId}/`);
  return response.data;
}

export async function createOrder(payload: OrderPayload) {
  const response = await apiClient.post<Order>("/orders/", payload);
  return response.data;
}

export async function sendOrderEmail(
  orderId: number,
  payload: { to_email: string; subject: string; body: string },
) {
  const response = await apiClient.post<{ detail: string }>(`/orders/${orderId}/send-order-email/`, payload);
  return response.data;
}

export async function updateOrder(orderId: number, payload: OrderUpdatePayload) {
  const response = await apiClient.patch<Order>(`/orders/${orderId}/`, payload);
  return response.data;
}

export async function listSavedEmailContacts() {
  const response = await apiClient.get<ListResponse<SavedEmailContact>>("/saved-email-contacts/");
  return unwrapListResponse(response.data);
}

export async function createSavedEmailContact(payload: { name?: string; email: string }) {
  const response = await apiClient.post<SavedEmailContact>("/saved-email-contacts/", payload);
  return response.data;
}
