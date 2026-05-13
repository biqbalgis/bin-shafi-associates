import { apiClient, unwrapListResponse } from "./http";
import type { Financial } from "../types";

export type FinancialPayload = {
  order: number;
  dr_no: string;
  digital_invoice: string;
  pso_invoice: string;
  pso_rate: string;
  pso_price: string;
  fueling_charges: string;
  bsa_invoice: string;
  bsa_rate: string;
  bsa_price: string;
  bsa_fueling_charges: string;
};

export type FinancialFilters = {
  search?: string;
  client?: number | "";
  approvalStatus?: "draft" | "approved" | "";
  dateFrom?: string;
  dateTo?: string;
  ordering?: string;
};

function normalizePayload(payload: FinancialPayload) {
  return {
    ...payload,
    pso_rate: payload.pso_rate || null,
    pso_price: payload.pso_price || null,
    fueling_charges: payload.fueling_charges || null,
    bsa_rate: payload.bsa_rate || null,
    bsa_price: payload.bsa_price || null,
    bsa_fueling_charges: payload.bsa_fueling_charges || null,
  };
}

export async function createFinancial(payload: FinancialPayload) {
  const response = await apiClient.post<Financial>("/financials/", normalizePayload(payload));
  return response.data;
}

export async function updateFinancial(id: number, payload: FinancialPayload) {
  const response = await apiClient.patch<Financial>(`/financials/${id}/`, normalizePayload(payload));
  return response.data;
}

export async function approveFinancial(id: number) {
  const response = await apiClient.post<Financial>(`/financials/${id}/approve-invoice/`);
  return response.data;
}

export async function unlockFinancial(id: number) {
  const response = await apiClient.post<Financial>(`/financials/${id}/unlock-invoice/`);
  return response.data;
}

export async function listFinancials(filters?: FinancialFilters) {
  const response = await apiClient.get<Financial[] | { results?: Financial[] }>("/financials/", {
    params: {
      search: filters?.search || undefined,
      client: filters?.client || undefined,
      is_locked:
        filters?.approvalStatus === "approved"
          ? true
          : filters?.approvalStatus === "draft"
            ? false
            : undefined,
      date_from: filters?.dateFrom || undefined,
      date_to: filters?.dateTo || undefined,
      ordering: filters?.ordering || "-order__date",
    },
  });
  return unwrapListResponse(response.data);
}
