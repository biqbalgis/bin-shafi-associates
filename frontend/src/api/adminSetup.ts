import { apiClient } from "./http";

export type ClientPayload = {
  name: string;
  code: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
};

export type AircraftPayload = {
  client: number;
  registration_no: string;
  aircraft_model: string;
  manufacturer?: string;
};

export type AirportPayload = {
  code: string;
  name: string;
  city?: string;
  country?: string;
};

export type FuelPayload = {
  name: string;
  description?: string;
};

export type FlightPayload = {
  code: string;
  description?: string;
};

export type RoutePayload = {
  name: string;
  description?: string;
};

export async function createClient(payload: ClientPayload) {
  const response = await apiClient.post("/clients/", payload);
  return response.data;
}

export async function createAircraft(payload: AircraftPayload) {
  const response = await apiClient.post("/aircrafts/", payload);
  return response.data;
}

export async function createAirport(payload: AirportPayload) {
  const response = await apiClient.post("/airports/", payload);
  return response.data;
}

export async function createFuelType(payload: FuelPayload) {
  const response = await apiClient.post("/fuel-types/", payload);
  return response.data;
}

export async function createFuelCategory(payload: FuelPayload) {
  const response = await apiClient.post("/fuel-categories/", payload);
  return response.data;
}

export async function createFlightOption(payload: FlightPayload) {
  const response = await apiClient.post("/flight-options/", payload);
  return response.data;
}

export async function createRouteOption(payload: RoutePayload) {
  const response = await apiClient.post("/route-options/", payload);
  return response.data;
}
