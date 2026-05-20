import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { isAxiosError } from "axios";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { createBulkClientPayment, createClientPayment, getClientStatement } from "../api/clients";
import {
  createBalanceSheet,
  getPsoSummary,
  listBalanceSheets,
  updateBalanceSheet,
  type BalanceSheetPayload,
} from "../api/balanceSheets";
import { fetchClients } from "../api/dropdowns";
import { getOrder } from "../api/orders";
import type {
  AviationPaymentWorkflow,
  BalanceSheet,
  Client,
  ClientInvoiceSummary,
  ClientPaymentMethod,
  ClientStatement,
  Order,
  PsoDeposit,
  PsoSummary,
} from "../types";

type DepositForm = {
  key: string;
  amount: string;
  date: string;
  mode: ClientPaymentMethod;
  reference: string;
};

type DailyDepositForm = {
  date: string;
  pso_dr_no: string;
  pso_consumed: string;
  pso_deposits: DepositForm[];
};

type AviationPaymentForm = {
  clientId: string;
  workflow: AviationPaymentWorkflow;
  orderId: string;
  amount: string;
  date: string;
  payment_method: ClientPaymentMethod;
  payment_reference: string;
};

const paymentMethodOptions: Array<{ value: ClientPaymentMethod; label: string }> = [
  { value: "", label: "Select method" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "ACCOUNT_TRANSFER", label: "Online" },
  { value: "CASH", label: "Cash" },
  { value: "OTHER", label: "Other" },
];

function getTodayValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function buildDepositKey(seed?: string | number) {
  return `${seed ?? "deposit"}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBalance(value: string | number | null | undefined) {
  return parseAmount(value).toFixed(2);
}

function extractApiErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError(error)) {
    return fallback;
  }

  const payload = error.response?.data;
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    if ("detail" in payload && typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    for (const value of Object.values(payload)) {
      if (typeof value === "string" && value.trim()) {
        return value;
      }
      if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
        return value[0];
      }
    }
  }

  return fallback;
}

function createDepositForm(date: string, deposit?: Partial<PsoDeposit>): DepositForm {
  return {
    key: buildDepositKey(deposit?.id ?? date),
    amount: deposit?.amount ?? "",
    date: deposit?.date ?? date,
    mode: deposit?.mode ?? "",
    reference: deposit?.reference ?? "",
  };
}

function createEmptyDailyDepositForm(date: string): DailyDepositForm {
  return {
    date,
    pso_dr_no: "",
    pso_consumed: "",
    pso_deposits: [],
  };
}

function createEmptyPaymentForm(date: string): AviationPaymentForm {
  return {
    clientId: "",
    workflow: "INVOICE_PAYMENT",
    orderId: "",
    amount: "",
    date,
    payment_method: "",
    payment_reference: "",
  };
}

function mapDailyRecordToForm(record: BalanceSheet, previousPsoDeposited: number): DailyDepositForm {
  const deposits =
    record.pso_deposits.length > 0
      ? record.pso_deposits.map((deposit) => createDepositForm(record.date, deposit))
      : (() => {
          const inferredAmount = Math.max(0, parseAmount(record.pso_deposited) - previousPsoDeposited);
          return inferredAmount > 0
            ? [createDepositForm(record.date, { amount: inferredAmount.toFixed(2), date: record.date })]
            : [];
        })();

  return {
    date: record.date,
    pso_dr_no: record.pso_dr_no,
    pso_consumed: record.pso_consumed,
    pso_deposits: deposits,
  };
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography color="text.secondary">{description}</Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
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

export default function BalanceSheetPage() {
  const params = useParams();
  const orderId = params.orderId ? Number(params.orderId) : null;
  const isOrderMode = Boolean(orderId);
  const today = getTodayValue();

  const [selectedDate, setSelectedDate] = useState(today);
  const [dailyForm, setDailyForm] = useState<DailyDepositForm>(() => createEmptyDailyDepositForm(today));
  const [currentRecord, setCurrentRecord] = useState<BalanceSheet | null>(null);
  const [previousPsoDeposited, setPreviousPsoDeposited] = useState(0);
  const [psoSummary, setPsoSummary] = useState<PsoSummary | null>(null);
  const [loadingDailyRecord, setLoadingDailyRecord] = useState(false);
  const [savingDailyRecord, setSavingDailyRecord] = useState(false);
  const [dailyMessage, setDailyMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [statement, setStatement] = useState<ClientStatement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paymentForm, setPaymentForm] = useState<AviationPaymentForm>(() => createEmptyPaymentForm(today));
  const [order, setOrder] = useState<Order | null>(null);

  async function loadClients() {
    setLoadingClients(true);
    try {
      const payload = await fetchClients();
      setClients(payload);
      return payload;
    } catch (error) {
      setPaymentMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Unable to load clients for the deposit sheet."),
      });
      return [];
    } finally {
      setLoadingClients(false);
    }
  }

  async function loadStatement(clientId: number) {
    setLoadingStatement(true);
    try {
      const payload = await getClientStatement(clientId);
      setStatement(payload);
      return payload;
    } catch (error) {
      setStatement(null);
      setPaymentMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Unable to load pending invoices for the selected client."),
      });
      return null;
    } finally {
      setLoadingStatement(false);
    }
  }

  useEffect(() => {
    void loadClients();
  }, []);

  useEffect(() => {
    if (isOrderMode || !selectedDate) {
      return;
    }

    let active = true;

    async function loadDailyRecord() {
      setLoadingDailyRecord(true);
      setDailyMessage(null);
      try {
        const records = await listBalanceSheets({ date_to: selectedDate, record_type: "daily" });
        if (!active) {
          return;
        }

        const exactRecord = records.find((record) => record.date === selectedDate) ?? null;
        const previousRecord = exactRecord
          ? records.find((record) => record.date < selectedDate) ?? null
          : records[0] ?? null;
        const openingDeposited = previousRecord ? parseAmount(previousRecord.pso_deposited) : 0;
        const summary = await getPsoSummary(selectedDate);

        setPreviousPsoDeposited(openingDeposited);
        setPsoSummary(summary);
        setCurrentRecord(exactRecord);
        setDailyForm(
          exactRecord
            ? mapDailyRecordToForm(exactRecord, openingDeposited)
            : {
                ...createEmptyDailyDepositForm(selectedDate),
                pso_consumed: summary.consumed,
              },
        );
      } catch (error) {
        if (active) {
          setDailyMessage({
            type: "error",
            text: extractApiErrorMessage(error, "Unable to load deposit-sheet data for the selected date."),
          });
          setCurrentRecord(null);
          setPreviousPsoDeposited(0);
          setPsoSummary(null);
          setDailyForm(createEmptyDailyDepositForm(selectedDate));
        }
      } finally {
        if (active) {
          setLoadingDailyRecord(false);
        }
      }
    }

    void loadDailyRecord();
    return () => {
      active = false;
    };
  }, [isOrderMode, selectedDate]);

  useEffect(() => {
    if (!isOrderMode || !orderId) {
      setOrder(null);
      return;
    }

    const currentOrderId = orderId;
    let active = true;
    async function loadOrderContext() {
      setPaymentMessage(null);
      try {
        const orderPayload = await getOrder(currentOrderId);
        if (!active) {
          return;
        }

        setOrder(orderPayload);
        setPaymentForm((current) => ({
          ...current,
          clientId: String(orderPayload.client),
          workflow: "INVOICE_PAYMENT",
          orderId: String(orderPayload.id),
        }));
      } catch (error) {
        if (active) {
          setOrder(null);
          setPaymentMessage({
            type: "error",
            text: extractApiErrorMessage(error, "Unable to load the selected order for the deposit sheet."),
          });
        }
      }
    }

    void loadOrderContext();
    return () => {
      active = false;
    };
  }, [isOrderMode, orderId]);

  useEffect(() => {
    if (!paymentForm.clientId) {
      setStatement(null);
      return;
    }
    void loadStatement(Number(paymentForm.clientId));
  }, [paymentForm.clientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === Number(paymentForm.clientId)) ?? null,
    [clients, paymentForm.clientId],
  );

  const pendingInvoices = useMemo(
    () =>
      (statement?.invoices ?? []).filter((invoice) => {
        return parseAmount(invoice.due_amount) > 0;
      }),
    [statement],
  );

  useEffect(() => {
    setPaymentForm((current) => {
      if (current.workflow !== "INVOICE_PAYMENT") {
        if (!current.orderId) {
          return current;
        }
        return {
          ...current,
          orderId: "",
        };
      }

      const hasCurrentInvoice = pendingInvoices.some((invoice) => String(invoice.order_id) === current.orderId);
      if (hasCurrentInvoice) {
        return current;
      }

      const preferredInvoice =
        (order && pendingInvoices.find((invoice) => invoice.order_id === order.id)) ?? pendingInvoices[0] ?? null;
      const nextOrderId = preferredInvoice ? String(preferredInvoice.order_id) : "";
      if (nextOrderId === current.orderId) {
        return current;
      }

      return {
        ...current,
        orderId: nextOrderId,
      };
    });
  }, [pendingInvoices, order, paymentForm.workflow]);

  const selectedInvoice = useMemo(
    () => pendingInvoices.find((invoice) => String(invoice.order_id) === paymentForm.orderId) ?? null,
    [pendingInvoices, paymentForm.orderId],
  );

  const depositTotal = dailyForm.pso_deposits.reduce((sum, deposit) => sum + parseAmount(deposit.amount), 0);
  const computedClientDue = paymentForm.workflow === "BULK_PAYMENT" ? statement?.totals.total_due : selectedInvoice?.due_amount;
  const psoDeposited = previousPsoDeposited + depositTotal;
  const psoConsumed = parseAmount(dailyForm.pso_consumed || psoSummary?.consumed);
  const psoBalance = psoDeposited - psoConsumed;

  function updateDepositRow(key: string, field: keyof Omit<DepositForm, "key">, value: string) {
    setDailyForm((current) => ({
      ...current,
      pso_deposits: current.pso_deposits.map((deposit) =>
        deposit.key === key ? { ...deposit, [field]: value } : deposit,
      ),
    }));
  }

  function addDepositRow() {
    setDailyForm((current) => ({
      ...current,
      pso_deposits: [...current.pso_deposits, createDepositForm(current.date)],
    }));
  }

  function removeDepositRow(key: string) {
    setDailyForm((current) => ({
      ...current,
      pso_deposits: current.pso_deposits.filter((deposit) => deposit.key !== key),
    }));
  }

  async function handlePaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPayment(true);
    setPaymentMessage(null);

    if (!paymentForm.clientId) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Select a client before recording payment." });
      return;
    }

    if (paymentForm.workflow === "INVOICE_PAYMENT" && (!paymentForm.orderId || !selectedInvoice)) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Select a pending DR number before recording payment." });
      return;
    }

    const amountPaid = parseAmount(paymentForm.amount);
    const dueAmount = parseAmount(computedClientDue);

    if (amountPaid <= 0) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Amount paid must be greater than zero." });
      return;
    }

    if (amountPaid > dueAmount) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Amount paid cannot be greater than the selected due amount." });
      return;
    }

    if (!paymentForm.date) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Select the paid date." });
      return;
    }

    if (!paymentForm.payment_method) {
      setSavingPayment(false);
      setPaymentMessage({ type: "error", text: "Select how the payment was made." });
      return;
    }

    try {
      if (paymentForm.workflow === "BULK_PAYMENT") {
        await createBulkClientPayment({
          client: Number(paymentForm.clientId),
          amount: paymentForm.amount,
          date: paymentForm.date,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.payment_reference,
        });
      } else {
        await createClientPayment({
          client: Number(paymentForm.clientId),
          order: Number(paymentForm.orderId),
          amount: paymentForm.amount,
          date: paymentForm.date,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.payment_reference,
          notes: "",
        });
      }

      await Promise.all([loadStatement(Number(paymentForm.clientId)), loadClients()]);

      setPaymentForm((current) => ({
        ...current,
        amount: "",
        payment_method: "",
        payment_reference: "",
        date: getTodayValue(),
      }));
      setPaymentMessage({
        type: "success",
        text:
          paymentForm.workflow === "BULK_PAYMENT"
            ? "Bulk client payment recorded and applied to the oldest pending invoices."
            : "Client payment recorded.",
      });
    } catch (error) {
      setPaymentMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Unable to record the client payment."),
      });
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDailyRecordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDailyRecord(true);
    setDailyMessage(null);

    const usedDeposits = dailyForm.pso_deposits.filter(
      (deposit) =>
        deposit.amount.trim() !== "" ||
        deposit.date.trim() !== "" ||
        deposit.mode.trim() !== "" ||
        deposit.reference.trim() !== "",
    );

    const hasInvalidDeposit = usedDeposits.some(
      (deposit) => deposit.amount.trim() === "" || deposit.date.trim() === "" || parseAmount(deposit.amount) <= 0,
    );
    if (hasInvalidDeposit) {
      setSavingDailyRecord(false);
      setDailyMessage({ type: "error", text: "Each PSO deposit needs a positive amount and a date." });
      return;
    }

    try {
      const payload: BalanceSheetPayload = {
        date: dailyForm.date,
        aviation_dr_no: "",
        aviation_total_due: "0",
        aviation_paid: "0",
        payment_method: "",
        payment_reference: "",
        payment_notes: "",
        pso_dr_no: dailyForm.pso_dr_no,
        pso_consumed: "0",
        pso_deposits: usedDeposits.map((deposit) => ({
          amount: deposit.amount,
          date: deposit.date,
          mode: deposit.mode,
          reference: deposit.reference,
        })),
      };

      if (currentRecord) {
        await updateBalanceSheet(currentRecord.id, payload);
      } else {
        await createBalanceSheet(payload);
      }

      const [records, summary] = await Promise.all([
        listBalanceSheets({ date_to: dailyForm.date, record_type: "daily" }),
        getPsoSummary(dailyForm.date),
      ]);
      const exactRecord = records.find((record) => record.date === dailyForm.date) ?? null;
      const previousRecord = exactRecord
        ? records.find((record) => record.date < dailyForm.date) ?? null
        : records[0] ?? null;
      const openingDeposited = previousRecord ? parseAmount(previousRecord.pso_deposited) : 0;

      setPreviousPsoDeposited(openingDeposited);
      setPsoSummary(summary);
      setCurrentRecord(exactRecord);
      setDailyForm(
        exactRecord
          ? mapDailyRecordToForm(exactRecord, openingDeposited)
          : {
              ...createEmptyDailyDepositForm(dailyForm.date),
              pso_consumed: summary.consumed,
            },
      );
      setDailyMessage({
        type: "success",
        text: currentRecord ? "Deposit sheet updated." : "Deposit sheet created.",
      });
    } catch (error) {
      setDailyMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Unable to save the deposit sheet. Check the date and numeric values."),
      });
    } finally {
      setSavingDailyRecord(false);
    }
  }

  function getInvoiceLabel(invoice: ClientInvoiceSummary) {
    const drNumber = invoice.dr_no || "No DR";
    return `${drNumber} | ${invoice.order_ser_no} | Due ${formatBalance(invoice.due_amount)}`;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">{isOrderMode ? "Order Deposit Sheet" : "Deposit Sheet"}</Typography>
        <Typography color="text.secondary">
          {isOrderMode
            ? "Record payment against the selected order invoice. Only pending invoices for that client can be paid here."
            : "Use invoice payment for one pending DR or bulk payment to apply a client payment across the oldest pending invoices. The PSO section tracks deposits against completed-invoice consumption automatically."}
        </Typography>
      </Box>

      {(loadingClients || loadingStatement) && <LinearProgress />}

      {(selectedClient || selectedInvoice || order) && (
        <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
          {order && (
            <SummaryCard
              label="Order"
              value={order.ser_no}
              caption={`${order.client_name} | ${order.dr_no || "No DR"}`}
            />
          )}
          <SummaryCard
            label="Client Due"
            value={formatBalance(statement?.totals.total_due)}
            caption={selectedClient ? `${selectedClient.name} outstanding balance` : "Select a client"}
          />
          <SummaryCard
            label="Pending DRs"
            value={String(pendingInvoices.length)}
            caption={selectedClient ? "Invoices with outstanding amount" : "No client selected"}
          />
          <SummaryCard
            label="Amount Due"
            value={formatBalance(computedClientDue)}
            caption={
              paymentForm.workflow === "BULK_PAYMENT"
                ? selectedClient
                  ? `${selectedClient.name} total pending amount`
                  : "Choose a client"
                : selectedInvoice
                  ? `${selectedInvoice.dr_no || selectedInvoice.order_ser_no} pending`
                  : "Choose a DR number"
            }
          />
        </Stack>
      )}

      <Stack component="form" spacing={3} onSubmit={handlePaymentSubmit}>
        <SectionCard
          title="Aviation"
          description="Select a client, choose invoice payment or bulk payment, review the amount due, and record how and when payment was made."
        >
          {paymentMessage && <Alert severity={paymentMessage.type}>{paymentMessage.text}</Alert>}

          {order && paymentForm.workflow === "INVOICE_PAYMENT" && !selectedInvoice && !loadingStatement && (
            <Alert severity="info">
              This order does not have a pending invoice right now. Choose another pending DR for the same client or go back to the overview.
            </Alert>
          )}

          {paymentForm.clientId && pendingInvoices.length === 0 && !loadingStatement && (
            <Alert severity="info">No pending DR numbers found for the selected client.</Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            }}
          >
            <TextField
              label="Select Client"
              select
              value={paymentForm.clientId}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  clientId: event.target.value,
                  orderId: "",
                  amount: "",
                  payment_reference: "",
                }))
              }
              fullWidth
              disabled={loadingClients}
            >
              {clients.map((client) => (
                <MenuItem key={client.id} value={String(client.id)}>
                  {client.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Payment Workflow"
              select
              value={paymentForm.workflow}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  workflow: event.target.value as AviationPaymentWorkflow,
                  orderId: "",
                  amount: "",
                  payment_reference: "",
                }))
              }
              fullWidth
              disabled={isOrderMode || !paymentForm.clientId}
            >
              <MenuItem value="BULK_PAYMENT">Bulk Payment</MenuItem>
              <MenuItem value="INVOICE_PAYMENT">Invoice Payment</MenuItem>
            </TextField>

            {paymentForm.workflow === "INVOICE_PAYMENT" && (
              <TextField
                label="Pending DR Number"
                select
                value={paymentForm.orderId}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    orderId: event.target.value,
                    amount: "",
                    payment_reference: "",
                  }))
                }
                fullWidth
                disabled={!paymentForm.clientId || loadingStatement || pendingInvoices.length === 0}
              >
                {pendingInvoices.map((invoice) => (
                  <MenuItem key={invoice.order_id} value={String(invoice.order_id)}>
                    {getInvoiceLabel(invoice)}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField label="Amount Due" value={formatBalance(computedClientDue)} InputProps={{ readOnly: true }} fullWidth />
            <TextField
              label="Amount Paid"
              type="number"
              value={paymentForm.amount}
              onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Paid Date"
              type="date"
              value={paymentForm.date}
              onChange={(event) => setPaymentForm((current) => ({ ...current, date: event.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Payment Method"
              select
              value={paymentForm.payment_method}
              onChange={(event) =>
                setPaymentForm((current) => ({ ...current, payment_method: event.target.value as ClientPaymentMethod }))
              }
              fullWidth
            >
              {paymentMethodOptions.map((option) => (
                <MenuItem key={option.value || "blank"} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Reference / Cheque No"
              value={paymentForm.payment_reference}
              onChange={(event) => setPaymentForm((current) => ({ ...current, payment_reference: event.target.value }))}
              placeholder="Cheque no, online reference, cash memo"
              fullWidth
            />
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1.5}>
              <Button component={Link} to="/balance-sheet/overview" variant="outlined">
                Open Deposit Overview
              </Button>
              {!isOrderMode && (
                <Button variant="outlined" onClick={() => void loadClients()} disabled={loadingClients || loadingStatement}>
                  Refresh Clients
                </Button>
              )}
            </Stack>
            <Button type="submit" variant="contained" disabled={savingPayment || loadingStatement || loadingClients}>
              {savingPayment ? "Saving Payment..." : "Save Payment"}
            </Button>
          </Stack>
        </SectionCard>
      </Stack>

      {!isOrderMode && (
        <>
          <Card>
            <CardContent>
              <Stack spacing={0.75}>
                <Typography variant="overline">Selected Date</Typography>
                <Typography variant="h6">{dailyForm.date}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Deposited total carried before this date: {formatBalance(previousPsoDeposited)}
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Stack component="form" spacing={3} onSubmit={handleDailyRecordSubmit}>
            <SectionCard title="PSO" description="Add deposit entries with date, amount, mode, and reference. Consumed is calculated automatically from completed invoices using Total PSO Price.">
              {dailyMessage && <Alert severity={dailyMessage.type}>{dailyMessage.text}</Alert>}
              {loadingDailyRecord && <Alert severity="info">Refreshing deposit sheet...</Alert>}

              <Stack spacing={2}>
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField
                    label="Date"
                    type="date"
                    value={dailyForm.date}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSelectedDate(nextValue);
                      setDailyForm((current) => ({ ...current, date: nextValue }));
                    }}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    label="DR Number"
                    value={dailyForm.pso_dr_no}
                    onChange={(event) => setDailyForm((current) => ({ ...current, pso_dr_no: event.target.value }))}
                    fullWidth
                  />
                </Box>

                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "stretch", sm: "center" }}
                        spacing={1.5}
                      >
                        <Box>
                          <Typography variant="subtitle1">Deposit History</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Add each PSO deposit separately so the payment mode and reference stay attached to the deposit sheet.
                          </Typography>
                        </Box>
                        <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={addDepositRow}>
                          Add Deposit
                        </Button>
                      </Stack>

                      {dailyForm.pso_deposits.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          No deposits added for this date yet.
                        </Typography>
                      )}

                      {dailyForm.pso_deposits.map((deposit) => (
                        <Box
                          key={deposit.key}
                          sx={{
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr 1fr auto" },
                            alignItems: "center",
                          }}
                        >
                          <TextField
                            label="Amount"
                            type="number"
                            value={deposit.amount}
                            onChange={(event) => updateDepositRow(deposit.key, "amount", event.target.value)}
                            fullWidth
                          />
                          <TextField
                            label="Date"
                            type="date"
                            value={deposit.date}
                            onChange={(event) => updateDepositRow(deposit.key, "date", event.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                          />
                          <TextField
                            label="Mode"
                            select
                            value={deposit.mode}
                            onChange={(event) =>
                              updateDepositRow(deposit.key, "mode", event.target.value as ClientPaymentMethod)
                            }
                            fullWidth
                          >
                            {paymentMethodOptions.map((option) => (
                              <MenuItem key={option.value || "blank"} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <TextField
                            label="Reference"
                            value={deposit.reference}
                            onChange={(event) => updateDepositRow(deposit.key, "reference", event.target.value)}
                            fullWidth
                          />
                          <Button color="error" onClick={() => removeDepositRow(deposit.key)} sx={{ minWidth: { md: 0 } }}>
                            <DeleteOutlineRoundedIcon />
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>

                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
                  }}
                >
                  <TextField label="Deposited" value={formatBalance(psoDeposited)} InputProps={{ readOnly: true }} fullWidth />
                  <TextField label="Consumed" value={formatBalance(psoConsumed)} InputProps={{ readOnly: true }} fullWidth />
                  <TextField label="Balance" value={formatBalance(psoBalance)} InputProps={{ readOnly: true }} fullWidth />
                </Box>
              </Stack>
            </SectionCard>

            <Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" disabled={savingDailyRecord || loadingDailyRecord}>
                {savingDailyRecord
                  ? "Saving..."
                  : currentRecord
                    ? "Update Deposit Sheet"
                    : "Save Deposit Sheet"}
              </Button>
            </Stack>
          </Stack>
        </>
      )}
    </Stack>
  );
}
