import { apiClient, unwrapListResponse } from "./http";
import type { BalanceSheet, ListResponse } from "../types";

export type BalanceSheetPayload = {
  date: string;
  aviation_total_due: string;
  aviation_paid: string;
  pso_deposited: string;
  pso_consumed: string;
};

export type BalanceSheetFilters = {
  date?: string;
  date_from?: string;
  date_to?: string;
};

function normalizeAmount(value: string) {
  return value.trim() === "" ? "0" : value;
}

function normalizePayload(payload: BalanceSheetPayload) {
  return {
    ...payload,
    aviation_total_due: normalizeAmount(payload.aviation_total_due),
    aviation_paid: normalizeAmount(payload.aviation_paid),
    pso_deposited: normalizeAmount(payload.pso_deposited),
    pso_consumed: normalizeAmount(payload.pso_consumed),
  };
}

export async function listBalanceSheets(filters?: BalanceSheetFilters) {
  const response = await apiClient.get<ListResponse<BalanceSheet>>("/balance-sheets/", {
    params: {
      date: filters?.date || undefined,
      date_from: filters?.date_from || undefined,
      date_to: filters?.date_to || undefined,
    },
  });
  return unwrapListResponse(response.data);
}

export async function createBalanceSheet(payload: BalanceSheetPayload) {
  const response = await apiClient.post<BalanceSheet>("/balance-sheets/", normalizePayload(payload));
  return response.data;
}

export async function updateBalanceSheet(id: number, payload: BalanceSheetPayload) {
  const response = await apiClient.patch<BalanceSheet>(`/balance-sheets/${id}/`, normalizePayload(payload));
  return response.data;
}
