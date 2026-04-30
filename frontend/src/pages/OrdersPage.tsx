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
  Divider,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { createSavedEmailContact, listOrders, listSavedEmailContacts, updateOrder } from "../api/orders";
import OrdersTable from "../components/OrdersTable";
import { useAuth } from "../context/AuthContext";
import type { Order, OrderScope, OrderStatus, SavedEmailContact } from "../types";

type EmailField = "approval_email_to" | "approval_email_cc";

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [scope, setScope] = useState<OrderScope>(user?.role === "CUSTOMER" ? "active" : "all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [savedEmailContacts, setSavedEmailContacts] = useState<SavedEmailContact[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailFieldTarget, setEmailFieldTarget] = useState<EmailField>("approval_email_to");
  const [emailForm, setEmailForm] = useState({ name: "", email: "" });

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
      const payload = await listOrders({ search, status, scope });
      setOrders(payload);
      setSelectedOrder((current) => payload.find((order) => order.id === current?.id) ?? payload[0] ?? null);
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
    } catch {
      setError("Unable to load saved email recipients.");
    }
  }

  useEffect(() => {
    loadOrders();
  }, [search, status, scope]);

  useEffect(() => {
    if (user?.role === "MANAGER") {
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

  async function handleCreateSavedEmail() {
    try {
      const created = await createSavedEmailContact({
        name: emailForm.name.trim() || undefined,
        email: emailForm.email.trim(),
      });
      setEmailDialogOpen(false);
      setEmailForm({ name: "", email: "" });
      await loadSavedContacts();
      if (selectedOrder) {
        await handleOrderUpdate(selectedOrder.id, { [emailFieldTarget]: created.email });
      }
    } catch {
      setError("Unable to save the email recipient.");
    }
  }

  function openEmailDialog(target: EmailField) {
    setEmailFieldTarget(target);
    setEmailDialogOpen(true);
  }

  function generateApprovalEmail(order: Order) {
    if (!order.approval_email_to) {
      setError("Select a saved recipient before generating the approval email.");
      return;
    }

    const subject = `Approval request for ${order.ser_no}`;
    const body = [
      "Please confirm approval for the following fuel order.",
      "",
      `Serial No: ${order.ser_no}`,
      `Date: ${new Date(order.date).toLocaleDateString()}`,
      `Flight: ${order.flight}`,
      `Client: ${order.client_name}`,
      `Aircraft: ${order.aircraft_registration}`,
      `Airport: ${order.airport_name}`,
      `Route: ${order.route}`,
      `Fuel Type: ${order.fuel_type_name}`,
      `Quantity (Ltrs): ${Number(order.quantity_ltrs).toLocaleString()}`,
      "",
      "Reply to this email once approval is received so the order can be marked approved manually.",
    ].join("\n");

    const params = new URLSearchParams({
      subject,
      body,
    });
    if (order.approval_email_cc) {
      params.set("cc", order.approval_email_cc);
    }
    window.location.href = `mailto:${encodeURIComponent(order.approval_email_to)}?${params.toString()}`;
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
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}
      {loading && <Alert severity="info">Refreshing orders...</Alert>}

      <OrdersTable
        orders={orders}
        role={user?.role ?? "CUSTOMER"}
        onOrderUpdate={handleOrderUpdate}
        onSelectOrder={setSelectedOrder}
      />

      {selectedOrder && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audit Trail / {selectedOrder.ser_no}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {selectedOrder.flight} ({selectedOrder.flight_status === "DOMESTIC" ? "Domestic" : "International"}) / {selectedOrder.client_name} / {selectedOrder.aircraft_registration}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              DR No: {selectedOrder.dr_no || "--"}
            </Typography>

            {user?.role === "MANAGER" && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Approval Email Draft
                </Typography>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                  <TextField
                    label="To"
                    select
                    value={selectedOrder.approval_email_to || ""}
                    onChange={(event) =>
                      handleOrderUpdate(selectedOrder.id, { approval_email_to: event.target.value })
                    }
                    fullWidth
                  >
                    <MenuItem value="">Select recipient</MenuItem>
                    {savedEmailContacts.map((contact) => (
                      <MenuItem key={contact.id} value={contact.email}>
                        {contact.name ? `${contact.name} / ${contact.email}` : contact.email}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="CC"
                    select
                    value={selectedOrder.approval_email_cc || ""}
                    onChange={(event) =>
                      handleOrderUpdate(selectedOrder.id, { approval_email_cc: event.target.value })
                    }
                    fullWidth
                  >
                    <MenuItem value="">Select CC recipient</MenuItem>
                    {savedEmailContacts.map((contact) => (
                      <MenuItem key={contact.id} value={contact.email}>
                        {contact.name ? `${contact.name} / ${contact.email}` : contact.email}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <Button variant="outlined" onClick={() => openEmailDialog("approval_email_to")}>
                    Add New To Email
                  </Button>
                  <Button variant="outlined" onClick={() => openEmailDialog("approval_email_cc")}>
                    Add New CC Email
                  </Button>
                  <Button variant="contained" onClick={() => generateApprovalEmail(selectedOrder)}>
                    Generate Email Draft
                  </Button>
                </Stack>
              </Box>
            )}

            <Stack spacing={2}>
              {selectedOrder.audit_logs.length === 0 && (
                <Typography color="text.secondary">No status changes logged yet.</Typography>
              )}
              {selectedOrder.audit_logs.map((log, index) => (
                <Box key={log.id}>
                  <Typography fontWeight={700}>
                    {log.old_status || "CREATED"} to {log.new_status}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {new Date(log.changed_at).toLocaleString()} by {log.changed_by_name ?? "system"}
                  </Typography>
                  {log.notes && (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      {log.notes}
                    </Typography>
                  )}
                  {index < selectedOrder.audit_logs.length - 1 && <Divider sx={{ mt: 2 }} />}
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Save Email Recipient</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={emailForm.name}
              onChange={(event) => setEmailForm((current) => ({ ...current, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={emailForm.email}
              onChange={(event) => setEmailForm((current) => ({ ...current, email: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateSavedEmail}
            variant="contained"
            disabled={!emailForm.email.trim()}
          >
            Save Recipient
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
