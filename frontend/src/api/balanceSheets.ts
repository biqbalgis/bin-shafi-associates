import { apiClient, unwrapListResponse } from "./http";
import type { BalanceSheet, ListResponse } from "../types";

export type BalanceSheetPayload = {
  date: string;
  order?: number | null;
  aviation_dr_no: string;
  aviation_total_due: string;
  aviation_paid: string;
  pso_dr_no: string;
  pso_consumed: string;
  pso_deposits: {
    amount: string;
    date: string;
    cheque_number: string;
  }[];
};

export type BalanceSheetFilters = {
  date?: string;
  date_from?: string;
  date_to?: string;
  order?: number;
  record_type?: "daily" | "order";
};

function normalizeAmount(value: string) {
  return value.trim() === "" ? "0" : value;
}

function normalizePayload(payload: BalanceSheetPayload) {
  return {
    ...payload,
    order: payload.order ?? undefined,
    aviation_dr_no: payload.aviation_dr_no.trim(),
    aviation_total_due: normalizeAmount(payload.aviation_total_due),
    aviation_paid: normalizeAmount(payload.aviation_paid),
    pso_dr_no: payload.pso_dr_no.trim(),
    pso_consumed: normalizeAmount(payload.pso_consumed),
    pso_deposits: payload.pso_deposits.map((deposit) => ({
      amount: normalizeAmount(deposit.amount),
      date: deposit.date,
      cheque_number: deposit.cheque_number.trim(),
    })),
  };
}

export async function listBalanceSheets(filters?: BalanceSheetFilters) {
  const response = await apiClient.get<ListResponse<BalanceSheet>>("/balance-sheets/", {
    params: {
      date: filters?.date || undefined,
      date_from: filters?.date_from || undefined,
      date_to: filters?.date_to || undefined,
      order: filters?.order || undefined,
      record_type: filters?.record_type || undefined,
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
