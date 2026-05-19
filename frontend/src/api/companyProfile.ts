import { apiClient } from "./http";
import type { CompanyProfile } from "../types";

export type CompanyProfilePayload = {
  company_name: string;
  address: string;
  phone: string;
  email: string;
};

export async function fetchCompanyProfile() {
  const response = await apiClient.get<CompanyProfile>("/company-profile/");
  return response.data;
}

export async function updateCompanyProfile(payload: CompanyProfilePayload) {
  const response = await apiClient.put<CompanyProfile>("/company-profile/", payload);
  return response.data;
}
