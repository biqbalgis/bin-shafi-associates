import { apiClient } from "./http";
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
