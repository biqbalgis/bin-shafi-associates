import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  LinearProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getClientStatement } from "../api/clients";
import { fetchClients } from "../api/dropdowns";
import { buildDateRange } from "../utils/dateFilters";
import type { Client, ClientPaymentMethod, ClientStatement, ClientStatementPayment } from "../types";

function parseAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatAmount(value: string | number | null | undefined) {
  return parseAmount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function getPaymentMethodLabel(method: ClientPaymentMethod) {
  switch (method) {
    case "CHEQUE":
      return "Cheque";
    case "ACCOUNT_TRANSFER":
      return "Account Transfer";
    case "CASH":
      return "Cash";
    case "OTHER":
      return "Other";
    default:
      return "Not recorded";
  }
}

function getStatusColor(status: "UNPAID" | "PARTIALLY_PAID" | "PAID") {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PARTIALLY_PAID":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

function SummaryCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent>
        <Stack spacing={0.75}>
          <Typography variant="overline">{label}</Typography>
          <Typography variant="h5">{value}</Typography>
          <Typography variant="body2" color="text.secondary">
            {caption}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PaymentDetailTable({ payments }: { payments: ClientStatementPayment[] }) {
  if (payments.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No payments recorded for this invoice yet.
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Paid Date</TableCell>
            <TableCell>Method</TableCell>
            <TableCell>Reference</TableCell>
            <TableCell>Notes</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id} hover>
              <TableCell>{formatDate(payment.date)}</TableCell>
              <TableCell>{getPaymentMethodLabel(payment.payment_method)}</TableCell>
              <TableCell>{payment.reference || "--"}</TableCell>
              <TableCell>{payment.notes || "--"}</TableCell>
              <TableCell align="right">{formatAmount(payment.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function BalanceSheetOverviewPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [statement, setStatement] = useState<ClientStatement | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState("");

  async function loadClients() {
    setLoadingClients(true);
    setError("");
    try {
      const payload = await fetchClients();
      setClients(payload);
      setSelectedClientId((current) => {
        if (current && payload.some((client) => String(client.id) === current)) {
          return current;
        }
        return payload[0] ? String(payload[0].id) : "";
      });
    } catch {
      setError("Unable to load clients for the financial overview.");
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadStatement(clientId: number) {
    setLoadingStatement(true);
    setError("");
    try {
      const payload = await getClientStatement(clientId);
      setStatement(payload);
      setExpandedInvoiceId(null);
    } catch {
      setStatement(null);
      setError("Unable to load the selected client's financial statement.");
    } finally {
      setLoadingStatement(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (!selectedClientId) {
      setStatement(null);
      return;
    }
    void loadStatement(Number(selectedClientId));
  }, [selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === Number(selectedClientId)) ?? null,
    [clients, selectedClientId],
  );

  const invoiceDateRange = buildDateRange({ day: dayFilter, month: monthFilter, year: yearFilter });
  const invoices = statement?.invoices ?? [];
  const filteredInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        if (!invoiceDateRange.dateFrom || !invoiceDateRange.dateTo) {
          return true;
        }
        return invoice.order_date >= invoiceDateRange.dateFrom && invoice.order_date <= invoiceDateRange.dateTo;
      }),
    [invoiceDateRange.dateFrom, invoiceDateRange.dateTo, invoices],
  );
  const paidInvoices = filteredInvoices.filter((invoice) => invoice.payment_status === "PAID").length;
  const partiallyPaidInvoices = filteredInvoices.filter((invoice) => invoice.payment_status === "PARTIALLY_PAID").length;
  const unpaidInvoices = filteredInvoices.filter((invoice) => invoice.payment_status === "UNPAID").length;
  const clientSnapshotTotals = useMemo(
    () =>
      clients.reduce(
        (totals, client) => ({
          totalOrders: totals.totalOrders + client.total_orders,
          completedOrders: totals.completedOrders + client.completed_orders,
          totalBilled: totals.totalBilled + parseAmount(client.total_billed),
          totalPaid: totals.totalPaid + parseAmount(client.total_paid),
          totalDue: totals.totalDue + parseAmount(client.total_due),
          totalProfit: totals.totalProfit + parseAmount(client.total_profit),
        }),
        {
          totalOrders: 0,
          completedOrders: 0,
          totalBilled: 0,
          totalPaid: 0,
          totalDue: 0,
          totalProfit: 0,
        },
      ),
    [clients],
  );

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Financial Overview</Typography>
          <Typography color="text.secondary">
            Select any client to review total amounts, paid amounts, payment dates, methods, and remaining dues.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => void loadClients()} disabled={loadingClients || loadingStatement}>
            Refresh
          </Button>
          <Button component={Link} to="/balance-sheet" variant="outlined">
            Deposit Sheet
          </Button>
        </Stack>
      </Box>

      {(loadingClients || loadingStatement) && <LinearProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">All Clients Snapshot</Typography>
              <Typography color="text.secondary">
                Compare each client's total amount, paid amount, remaining amount, and profit, then open one client's detailed statement below.
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Client</TableCell>
                    <TableCell align="right">Orders</TableCell>
                    <TableCell align="right">Completed</TableCell>
                    <TableCell align="right">Total Amount</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Remaining</TableCell>
                    <TableCell align="right">Profit</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {clients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        {loadingClients ? "Loading clients..." : "No active clients found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {clients.map((client) => (
                    <TableRow key={client.id} hover selected={client.id === Number(selectedClientId)}>
                      <TableCell>
                        <Typography fontWeight={700}>{client.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {client.code}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{client.total_orders}</TableCell>
                      <TableCell align="right">{client.completed_orders}</TableCell>
                      <TableCell align="right">{formatAmount(client.total_billed)}</TableCell>
                      <TableCell align="right">{formatAmount(client.total_paid)}</TableCell>
                      <TableCell align="right">{formatAmount(client.total_due)}</TableCell>
                      <TableCell align="right">{formatAmount(client.total_profit)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant={client.id === Number(selectedClientId) ? "contained" : "outlined"} onClick={() => setSelectedClientId(String(client.id))}>
                          {client.id === Number(selectedClientId) ? "Selected" : "Open"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {clients.length > 0 && (
                  <TableFooter>
                    <TableRow
                      sx={{
                        "& td": {
                          borderTop: "2px solid",
                          borderColor: "divider",
                          color: "text.primary",
                          fontWeight: 800,
                          pt: 2,
                        },
                      }}
                    >
                      <TableCell>
                        <Typography fontWeight={800}>Total</Typography>
                        <Typography variant="body2" color="text.secondary">
                          All clients
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{clientSnapshotTotals.totalOrders}</TableCell>
                      <TableCell align="right">{clientSnapshotTotals.completedOrders}</TableCell>
                      <TableCell align="right">{formatAmount(clientSnapshotTotals.totalBilled)}</TableCell>
                      <TableCell align="right">{formatAmount(clientSnapshotTotals.totalPaid)}</TableCell>
                      <TableCell align="right">{formatAmount(clientSnapshotTotals.totalDue)}</TableCell>
                      <TableCell align="right">{formatAmount(clientSnapshotTotals.totalProfit)}</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2.5}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", lg: "minmax(280px, 360px) 1fr" },
                alignItems: "start",
              }}
            >
              <TextField
                label="Selected Client"
                select
                value={selectedClientId}
                onChange={(event) => setSelectedClientId(event.target.value)}
                fullWidth
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={String(client.id)}>
                    {client.name}
                  </MenuItem>
                ))}
              </TextField>

              <Box>
                <Typography variant="h6">{selectedClient?.name ?? "No client selected"}</Typography>
                <Typography color="text.secondary">
                  {selectedClient
                    ? `${selectedClient.code} | ${selectedClient.contact_email || "No email"} | ${selectedClient.contact_phone || "No phone"}`
                    : "Choose a client to load invoices and payments."}
                </Typography>
                {selectedClient?.address && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                    {selectedClient.address}
                  </Typography>
                )}
              </Box>
            </Box>

            <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
              <SummaryCard
                label="Invoices"
                value={`${paidInvoices} / ${invoices.length}`}
                caption={`${partiallyPaidInvoices} partial | ${unpaidInvoices} unpaid`}
              />
              <SummaryCard
                label="Previously Billed"
                value={formatAmount(statement?.totals.previously_billed)}
                caption="Amount billed before the latest completed invoice"
              />
              <SummaryCard
                label="Current Billed"
                value={formatAmount(statement?.totals.current_billed)}
                caption="Latest completed invoice amount"
              />
              <SummaryCard
                label="Total Billed"
                value={formatAmount(statement?.totals.total_billed)}
                caption={`${statement?.totals.completed_orders ?? 0} completed invoices combined`}
              />
              <SummaryCard
                label="Total Paid"
                value={formatAmount(statement?.totals.total_paid)}
                caption="All recorded client payments"
              />
              <SummaryCard
                label="Current Due"
                value={formatAmount(statement?.totals.total_due)}
                caption="Outstanding amount for this client"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Invoice Status</Typography>
              <Typography color="text.secondary">
                Each completed order is treated as a client invoice. Expand a row to inspect payment date, method, reference, and notes.
              </Typography>
              <Box
                sx={{
                  mt: 2,
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
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Order Date</TableCell>
                    <TableCell>Order</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>DR</TableCell>
                    <TableCell align="right">Invoice Total</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Due</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInvoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        {loadingStatement
                          ? "Loading invoice status..."
                          : "No completed invoices found for this client in the selected period."}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredInvoices.map((invoice) => {
                    const isExpanded = expandedInvoiceId === invoice.order_id;
                    return (
                      <Fragment key={invoice.order_id}>
                        <TableRow hover>
                          <TableCell width={64}>
                            <Button size="small" variant="text" onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.order_id)}>
                              {isExpanded ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
                            </Button>
                          </TableCell>
                          <TableCell>{formatDate(invoice.order_date)}</TableCell>
                          <TableCell>{invoice.order_ser_no}</TableCell>
                          <TableCell>{invoice.invoice_no || "--"}</TableCell>
                          <TableCell>{invoice.dr_no || "--"}</TableCell>
                          <TableCell align="right">{formatAmount(invoice.invoice_amount)}</TableCell>
                          <TableCell align="right">{formatAmount(invoice.total_paid)}</TableCell>
                          <TableCell align="right">{formatAmount(invoice.due_amount)}</TableCell>
                          <TableCell>
                            <Chip label={invoice.payment_status.replace(/_/g, " ")} color={getStatusColor(invoice.payment_status)} variant={invoice.payment_status === "UNPAID" ? "outlined" : "filled"} />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={9} sx={{ py: 0, borderBottom: isExpanded ? undefined : "none" }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box sx={{ px: 2, py: 2 }}>
                                <Stack spacing={2}>
                                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                                    <SummaryCard
                                      label="Payments"
                                      value={String(invoice.payment_count)}
                                      caption={`Last payment: ${formatDate(invoice.last_paid_date)}`}
                                    />
                                    <SummaryCard
                                      label="Invoice Due"
                                      value={formatAmount(invoice.due_amount)}
                                      caption={`Invoice total ${formatAmount(invoice.invoice_amount)}`}
                                    />
                                  </Stack>
                                  <PaymentDetailTable payments={invoice.payments} />
                                  <Box>
                                    <Button component={Link} to={`/balance-sheet/${invoice.order_id}`} size="small" variant="outlined">
                                      Open Deposit Sheet
                                    </Button>
                                  </Box>
                                </Stack>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
