import AddCircleRoundedIcon from "@mui/icons-material/AddCircleRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { listOrders, listSavedEmailContacts, sendOrderEmail, updateOrder } from "../api/orders";
import OrdersTable from "../components/OrdersTable";
import { useAuth } from "../context/AuthContext";
import { buildDateRange } from "../utils/dateFilters";
import type { Order, OrderScope, OrderStatus, SavedEmailContact } from "../types";

const orderStatuses: OrderStatus[] = ["PENDING", "APPROVED", "COMPLETED", "CANCELED"];
const orderScopes: OrderScope[] = ["all", "active", "completed"];

function getQueryStatus(value: string | null): OrderStatus | "" {
  return orderStatuses.includes(value as OrderStatus) ? (value as OrderStatus) : "";
}

function getQueryScope(value: string | null, fallback: OrderScope): OrderScope {
  return orderScopes.includes(value as OrderScope) ? (value as OrderScope) : fallback;
}

function buildPendingOrderEmailSubject(order: Order) {
  return `Pending fuel order ${order.ser_no} - ${order.client_name}`;
}

function buildPendingOrderEmailBody(order: Order) {
  return [
    "Dear Team,",
    "",
    "A new aviation fuel order is pending approval. Please review the order details below.",
    "",
    `Serial No: ${order.ser_no}`,
    `Order Date: ${new Date(order.date).toLocaleDateString()}`,
    `Status: ${order.status}`,
    `Flight: ${order.flight}`,
    `Flight Status: ${order.flight_status === "DOMESTIC" ? "Domestic" : "International"}`,
    `Client: ${order.client_name}`,
    `Aircraft: ${order.aircraft_registration}`,
    `Airport: ${order.airport_name}`,
    `Route: ${order.route}`,
    `Fuel Type: ${order.fuel_type_name}`,
    `Quantity: ${Number(order.quantity_ltrs).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} Ltrs`,
    `DR No: ${order.dr_no || "Not assigned"}`,
    `Created By: ${order.created_by_name}`,
    `Created At: ${new Date(order.created_at).toLocaleString()}`,
    "",
    "The order PDF is attached for your records.",
    "",
    "Regards,",
    "Bin Shafi Aviation Fuel System",
  ].join("\n");
}

export default function OrdersPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryString = searchParams.toString();
  const defaultScope = user?.role === "CUSTOMER" ? "active" : "all";
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [status, setStatus] = useState<OrderStatus | "">(() => getQueryStatus(searchParams.get("status")));
  const [scope, setScope] = useState<OrderScope>(() => getQueryScope(searchParams.get("scope"), defaultScope));
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedEmailContacts, setSavedEmailContacts] = useState<SavedEmailContact[]>([]);
  const [emailOrder, setEmailOrder] = useState<Order | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const nextParams = new URLSearchParams(queryString);
    setSearch(nextParams.get("search") || "");
    setStatus(getQueryStatus(nextParams.get("status")));
    setScope(getQueryScope(nextParams.get("scope"), defaultScope));
  }, [queryString, defaultScope]);

  useEffect(() => {
    if (user?.role === "CUSTOMER") {
      setScope((current) => (current === "all" ? "active" : current));
    }
  }, [user?.role]);

  useEffect(() => {
    if (scope === "completed" && status && status !== "COMPLETED") {
      setStatus("");
    }
    if (scope === "active" && status === "COMPLETED") {
      setStatus("");
    }
  }, [scope, status]);

  async function loadOrders() {
    setLoading(true);
    setError("");
    try {
      const dateRange = buildDateRange({ day: dayFilter, month: monthFilter, year: yearFilter });
      const payload = await listOrders({ search, status, scope, ...dateRange });
      setOrders(payload);
    } catch {
      setError("Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedContacts() {
    try {
      const payload = await listSavedEmailContacts();
      setSavedEmailContacts(payload);
      setSelectedRecipient((current) => current || payload[0]?.email || "");
    } catch {
      setError("Unable to load saved email recipients.");
    }
  }

  useEffect(() => {
    loadOrders();
  }, [search, status, scope, dayFilter, monthFilter, yearFilter]);

  useEffect(() => {
    if (user?.role && user.role !== "CUSTOMER") {
      loadSavedContacts();
    }
  }, [user?.role]);

  async function handleOrderUpdate(
    orderId: number,
    payload: { status?: OrderStatus; dr_no?: string; approval_email_to?: string; approval_email_cc?: string },
  ) {
    try {
      await updateOrder(orderId, payload);
      await loadOrders();
    } catch {
      setError("Order update failed.");
    }
  }

  function openOrderEmailDialog(order: Order) {
    setError("");
    setSuccess("");
    setEmailOrder(order);
    setSelectedRecipient(order.approval_email_to || savedEmailContacts[0]?.email || "");
  }

  async function handleSendOrderEmail() {
    if (!emailOrder || !selectedRecipient) {
      setError("Select a recipient before sending the order email.");
      return;
    }

    setSendingEmail(true);
    setError("");
    setSuccess("");
    try {
      await sendOrderEmail(emailOrder.id, {
        to_email: selectedRecipient,
        subject: buildPendingOrderEmailSubject(emailOrder),
        body: buildPendingOrderEmailBody(emailOrder),
      });
      await updateOrder(emailOrder.id, { approval_email_to: selectedRecipient });
      await loadOrders();
      setSuccess(`Order email sent to ${selectedRecipient}.`);
      setConfirmEmailOpen(false);
      setEmailOrder(null);
    } catch {
      setError("Unable to send the order email.");
    } finally {
      setSendingEmail(false);
    }
  }

  const scopeTabs =
    user?.role === "CUSTOMER"
      ? [
          { value: "active" as OrderScope, label: "Pending & Approved" },
          { value: "completed" as OrderScope, label: "Completed" },
        ]
      : [
          { value: "all" as OrderScope, label: "All Orders" },
          { value: "active" as OrderScope, label: "Open Orders" },
          { value: "completed" as OrderScope, label: "Completed" },
        ];

  const statusOptions =
    scope === "completed"
      ? ["COMPLETED"]
      : scope === "active"
        ? ["PENDING", "APPROVED"]
        : user?.role === "CUSTOMER"
          ? ["PENDING", "APPROVED", "COMPLETED"]
          : ["PENDING", "APPROVED", "COMPLETED", "CANCELED"];

  return (
    <Stack spacing={3}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        flexDirection={{ xs: "column", md: "row" }}
        gap={2}
      >
        <Box>
          <Typography variant="h4">Orders</Typography>
          <Typography color="text.secondary">
            Customers see only their own submitted orders. Completed work is separated from the active queue.
          </Typography>
        </Box>
        <Button component={Link} to="/orders/new" variant="contained" startIcon={<AddCircleRoundedIcon />}>
          Create Order
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Tabs value={scope} onChange={(_event, nextValue) => setScope(nextValue)} variant="scrollable" allowScrollButtonsMobile>
              {scopeTabs.map((tab) => (
                <Tab key={tab.value} value={tab.value} label={tab.label} />
              ))}
            </Tabs>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Search"
                placeholder="Serial, flight, route, client"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
              />
              <TextField
                label="Status"
                select
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus | "")}
                sx={{ minWidth: 220 }}
              >
                <MenuItem value="">All statuses</MenuItem>
                {statusOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              <TextField
                label="Day"
                type="date"
                value={dayFilter}
                onChange={(event) => {
                  setDayFilter(event.target.value);
                  if (event.target.value) {
                    setMonthFilter("");
                    setYearFilter("");
                  }
                }}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Month"
                type="month"
                value={monthFilter}
                onChange={(event) => {
                  setMonthFilter(event.target.value);
                  if (event.target.value) {
                    setDayFilter("");
                    setYearFilter("");
                  }
                }}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Year"
                type="number"
                inputProps={{ min: 1900, max: 2100 }}
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value);
                  if (event.target.value) {
                    setDayFilter("");
                    setMonthFilter("");
                  }
                }}
                fullWidth
              />
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {loading && <Alert severity="info">Refreshing orders...</Alert>}

      <OrdersTable
        orders={orders}
        role={user?.role ?? "CUSTOMER"}
        onOrderUpdate={handleOrderUpdate}
        onSendOrderEmail={user?.role && user.role !== "CUSTOMER" ? openOrderEmailDialog : undefined}
      />

      <Dialog open={Boolean(emailOrder)} onClose={() => setEmailOrder(null)} fullWidth maxWidth="md">
        <DialogTitle>Send Order Email</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {savedEmailContacts.length === 0 && (
              <Alert severity="info">Add order mail recipients in Admin Setup before sending emails.</Alert>
            )}
            <TextField
              label="Recipient"
              select
              value={selectedRecipient}
              onChange={(event) => setSelectedRecipient(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Select saved email</MenuItem>
              {savedEmailContacts.map((contact) => (
                <MenuItem key={contact.id} value={contact.email}>
                  {contact.email}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Subject"
              value={emailOrder ? buildPendingOrderEmailSubject(emailOrder) : ""}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Email Body"
              value={emailOrder ? buildPendingOrderEmailBody(emailOrder) : ""}
              fullWidth
              multiline
              minRows={14}
              InputProps={{ readOnly: true }}
            />
            <Alert severity="info">
              PDF attachment: {emailOrder?.ser_no || "Order"}.pdf
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailOrder(null)}>Cancel</Button>
          <Button
            onClick={() => setConfirmEmailOpen(true)}
            variant="contained"
            disabled={!selectedRecipient || savedEmailContacts.length === 0}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmEmailOpen} onClose={() => setConfirmEmailOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Email</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to send order {emailOrder?.ser_no} to {selectedRecipient}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmEmailOpen(false)} disabled={sendingEmail}>
            Cancel
          </Button>
          <Button onClick={() => void handleSendOrderEmail()} variant="contained" disabled={sendingEmail}>
            {sendingEmail ? "Sending..." : "Yes, Send"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
