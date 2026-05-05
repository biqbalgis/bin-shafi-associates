export type UserRole = "CUSTOMER" | "MANAGER" | "ADMIN";

export type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  client: number | null;
  client_name: string | null;
  is_active: boolean;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

export type Client = {
  id: number;
  name: string;
  code: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  is_active: boolean;
};

export type Aircraft = {
  id: number;
  client: number;
  client_name: string;
  registration_no: string;
  aircraft_model: string;
  manufacturer: string;
  active: boolean;
};

export type Airport = {
  id: number;
  code: string;
  name: string;
  city: string;
  country: string;
  active: boolean;
};

export type FuelType = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};

export type FuelCategory = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};

export type FlightOption = {
  id: number;
  code: string;
  description: string;
  active: boolean;
};

export type RouteOption = {
  id: number;
  name: string;
  description: string;
  active: boolean;
};

export type OrderStatus = "PENDING" | "APPROVED" | "CANCELED" | "COMPLETED";
export type FlightStatus = "DOMESTIC" | "INTERNATIONAL";
export type OrderScope = "all" | "active" | "completed";

export type SavedEmailContact = {
  id: number;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: number;
  old_status: OrderStatus | "";
  new_status: OrderStatus;
  changed_by: number | null;
  changed_by_name: string | null;
  notes: string;
  changed_at: string;
};

export type Financial = {
  id: number;
  order: number;
  order_ser_no: string;
  dr_no: string;
  digital_invoice: string;
  pso_invoice: string;
  pso_rate: string | null;
  pso_price: string | null;
  fueling_charges: string | null;
  pso_gst: string | null;
  pso_total_price: string | null;
  bsa_invoice: string;
  bsa_rate: string | null;
  bsa_price: string | null;
  bsa_fueling_charges: string | null;
  bsa_gst: string | null;
  bsa_total_price: string | null;
  profit: string;
  created_at: string;
  updated_at: string;
};

export type BalanceSheet = {
  id: number;
  date: string;
  aviation_dr_no: string;
  aviation_total_due: string;
  aviation_paid: string;
  aviation_balance: string;
  pso_dr_no: string;
  pso_deposited: string;
  pso_consumed: string;
  pso_balance: string;
  pso_deposits: PsoDeposit[];
  created_by: number | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
};

export type PsoDeposit = {
  id: number;
  amount: string;
  date: string;
  cheque_number: string;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: number;
  ser_no: string;
  date: string;
  flight: string;
  flight_status: FlightStatus;
  client: number;
  client_name: string;
  aircraft: number;
  aircraft_registration: string;
  airport: number;
  airport_name: string;
  route: string;
  dr_no: string;
  approval_email_to: string;
  approval_email_cc: string;
  status: OrderStatus;
  fuel_type: number;
  fuel_type_name: string;
  quantity_ltrs: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  audit_logs: AuditLog[];
  financial: Financial | null;
};

export type ListResponse<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: T[];
} | T[];
