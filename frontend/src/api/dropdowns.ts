import { apiClient, unwrapListResponse } from "./http";
import type {
  Aircraft,
  Airport,
  Client,
  FlightOption,
  FuelCategory,
  FuelType,
  ListResponse,
  RouteOption,
} from "../types";

export async function fetchClients() {
  const response = await apiClient.get<ListResponse<Client>>("/clients/");
  return unwrapListResponse(response.data);
}

export async function fetchAircrafts(clientId?: number | null) {
  const response = await apiClient.get<ListResponse<Aircraft>>("/aircrafts/", {
    params: clientId ? { client: clientId } : undefined,
  });
  return unwrapListResponse(response.data);
}

export async function fetchAirports() {
  const response = await apiClient.get<ListResponse<Airport>>("/airports/");
  return unwrapListResponse(response.data);
}

export async function fetchFuelTypes() {
  const response = await apiClient.get<ListResponse<FuelType>>("/fuel-types/");
  return unwrapListResponse(response.data);
}

export async function fetchFuelCategories() {
  const response = await apiClient.get<ListResponse<FuelCategory>>("/fuel-categories/");
  return unwrapListResponse(response.data);
}

export async function fetchFlightOptions() {
  const response = await apiClient.get<ListResponse<FlightOption>>("/flight-options/");
  return unwrapListResponse(response.data);
}

export async function fetchRouteOptions() {
  const response = await apiClient.get<ListResponse<RouteOption>>("/route-options/");
  return unwrapListResponse(response.data);
}
