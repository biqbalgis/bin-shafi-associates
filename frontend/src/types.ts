export type UserRole = "CUSTOMER" | "MANAGER" | "ADMIN";
export type ClientPaymentMethod = "" | "CHEQUE" | "ACCOUNT_TRANSFER" | "CASH" | "OTHER";
export type AviationPaymentWorkflow = "INVOICE_PAYMENT" | "BULK_PAYMENT";

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
  total_orders: number;
  completed_orders: number;
  total_billed: string;
  total_paid: string;
  total_due: string;
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

export type CompanyProfile = {
  id: number;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  signature_image: string | null;
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
  order_date: string;
  client: number;
  client_name: string;
  dr_no: string;
  digital_invoice: string;
  pso_invoice: string;
  pso_rate: string | null;
  pso_price: string | null;
  fueling_charges: string | null;
  pso_gst: string | null;
  pso_total_price: string | null;
  bsa_invoice: string;
  invoice_generated_at: string | null;
  bsa_rate: string | null;
  bsa_price: string | null;
  bsa_fueling_charges: string | null;
  bsa_gst: string | null;
  bsa_total_price: string | null;
  profit: string;
  is_locked: boolean;
  approved_at: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type BalanceSheet = {
  id: number;
  date: string;
  order: number | null;
  order_ser_no: string;
  client: number | null;
  client_name: string | null;
  aviation_dr_no: string;
  aviation_total_due: string;
  aviation_paid: string;
  aviation_balance: string;
  payment_method: ClientPaymentMethod;
  payment_reference: string;
  payment_notes: string;
  pso_dr_no: string;
  pso_deposited: string;
  pso_consumed: string;
  pso_balance: string;
  pso_deposits: PsoDeposit[];
  created_by: number | null;
  created_by_username: string | null;
  client_payment_id: number | null;
  created_at: string;
  updated_at: string;
};

export type PsoDeposit = {
  id: number;
  amount: string;
  date: string;
  mode: ClientPaymentMethod;
  reference: string;
  created_at: string;
  updated_at: string;
};

export type PsoSummary = {
  date: string;
  deposited: string;
  consumed: string;
  balance: string;
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
  order_total_due: string | null;
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

export type ClientStatementEntry = {
  entry_type: "ORDER" | "PAYMENT";
  date: string;
  order_id: number | null;
  order_ser_no: string;
  dr_no: string;
  invoice_no: string;
  reference: string;
  notes: string;
  payment_method: ClientPaymentMethod;
  billed_amount: string;
  paid_amount: string;
  balance_after: string;
};

export type ClientStatementPayment = {
  id: number;
  date: string;
  amount: string;
  payment_method: ClientPaymentMethod;
  reference: string;
  notes: string;
  created_by_username: string | null;
  created_at: string;
};

export type BulkClientPaymentAllocation = {
  payment_id: number;
  order: number;
  order_ser_no: string;
  amount: string;
};

export type BulkClientPaymentResponse = {
  client: number;
  total_due: string;
  amount_allocated: string;
  advance_amount: string;
  allocation_count: number;
  allocations: BulkClientPaymentAllocation[];
};

export type ClientInvoiceSummary = {
  order_id: number;
  order_ser_no: string;
  order_date: string;
  completed_at: string | null;
  dr_no: string;
  invoice_no: string;
  invoice_amount: string;
  total_paid: string;
  due_amount: string;
  payment_status: "UNPAID" | "PARTIALLY_PAID" | "PAID";
  payment_count: number;
  last_paid_date: string | null;
  payments: ClientStatementPayment[];
};

export type ClientBalanceTotals = {
  total_orders: number;
  completed_orders: number;
  previously_billed: string;
  current_billed: string;
  total_billed: string;
  total_paid: string;
  total_due: string;
};

export type ClientStatement = {
  client: Client;
  totals: ClientBalanceTotals;
  entries: ClientStatementEntry[];
  invoices: ClientInvoiceSummary[];
};
