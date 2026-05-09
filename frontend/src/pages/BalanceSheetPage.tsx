import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { isAxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  createBalanceSheet,
  listBalanceSheets,
  updateBalanceSheet,
  type BalanceSheetPayload,
} from "../api/balanceSheets";
import { fetchClients } from "../api/dropdowns";
import { getOrder } from "../api/orders";
import type { BalanceSheet, Client, Order, PsoDeposit } from "../types";

type DepositForm = {
  key: string;
  amount: string;
  date: string;
  cheque_number: string;
};

type BalanceSheetForm = {
  date: string;
  aviation_dr_no: string;
  aviation_total_due: string;
  aviation_paid: string;
  pso_dr_no: string;
  pso_consumed: string;
  pso_deposits: DepositForm[];
};

const emptyForm = (date: string): BalanceSheetForm => ({
  date,
  aviation_dr_no: "",
  aviation_total_due: "",
  aviation_paid: "",
  pso_dr_no: "",
  pso_consumed: "",
  pso_deposits: [],
});

function getTodayValue() {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function parseAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBalance(value: string | number) {
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

function buildDepositKey(seed?: string | number) {
  return `${seed ?? "deposit"}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDepositForm(date: string, deposit?: Partial<PsoDeposit>): DepositForm {
  return {
    key: buildDepositKey(deposit?.id ?? date),
    amount: deposit?.amount ?? "",
    date: deposit?.date ?? date,
    cheque_number: deposit?.cheque_number ?? "",
  };
}

function mapDailyRecordToForm(record: BalanceSheet, previousPsoBalance: number): BalanceSheetForm {
  const deposits =
    record.pso_deposits.length > 0
      ? record.pso_deposits.map((deposit) => createDepositForm(record.date, deposit))
      : (() => {
          const inferredAmount = Math.max(0, parseAmount(record.pso_deposited) - previousPsoBalance);
          return inferredAmount > 0
            ? [createDepositForm(record.date, { amount: inferredAmount.toFixed(2), date: record.date })]
            : [];
        })();

  return {
    date: record.date,
    aviation_dr_no: record.aviation_dr_no,
    aviation_total_due: record.aviation_total_due,
    aviation_paid: record.aviation_paid,
    pso_dr_no: record.pso_dr_no,
    pso_consumed: record.pso_consumed,
    pso_deposits: deposits,
  };
}

function mapOrderRecordToForm(record: BalanceSheet, order: Order, fallbackDate: string): BalanceSheetForm {
  return {
    date: record.date || fallbackDate,
    aviation_dr_no: record.aviation_dr_no || order.dr_no || order.financial?.dr_no || "",
    aviation_total_due: order.order_total_due || record.aviation_total_due || "",
    aviation_paid: record.aviation_paid || "",
    pso_dr_no: "",
    pso_consumed: "",
    pso_deposits: [],
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
  const [selectedDate, setSelectedDate] = useState(getTodayValue());
  const [form, setForm] = useState<BalanceSheetForm>(() => emptyForm(getTodayValue()));
  const [currentRecord, setCurrentRecord] = useState<BalanceSheet | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [clientSummary, setClientSummary] = useState<Client | null>(null);
  const [previousPsoBalance, setPreviousPsoBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setMessage(null);
  }, [orderId]);

  useEffect(() => {
    if (isOrderMode || !selectedDate) {
      return;
    }

    let active = true;
    async function loadDailyRecord() {
      setLoading(true);
      setMessage(null);
      try {
        const records = await listBalanceSheets({ date_to: selectedDate, record_type: "daily" });
        if (!active) {
          return;
        }

        const exactRecord = records.find((record) => record.date === selectedDate) ?? null;
        const previousRecord = exactRecord
          ? records.find((record) => record.date < selectedDate) ?? null
          : records[0] ?? null;
        const openingBalance = previousRecord ? parseAmount(previousRecord.pso_balance) : 0;

        setPreviousPsoBalance(openingBalance);
        setCurrentRecord(exactRecord);
        setOrder(null);
        setClientSummary(null);
        setForm(exactRecord ? mapDailyRecordToForm(exactRecord, openingBalance) : emptyForm(selectedDate));
      } catch (error) {
        if (active) {
          setMessage({
            type: "error",
            text: extractApiErrorMessage(error, "Unable to load balance-sheet data for the selected date."),
          });
          setCurrentRecord(null);
          setPreviousPsoBalance(0);
        }
      } finally {
        if (active) {
          setLoading(false);
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
      return;
    }
    const currentOrderId = orderId;

    let active = true;
    async function loadOrderRecord() {
      setLoading(true);
      setMessage(null);
      try {
        const [orderPayload, records, clients] = await Promise.all([
          getOrder(currentOrderId),
          listBalanceSheets({ order: currentOrderId, record_type: "order" }),
          fetchClients(),
        ]);
        if (!active) {
          return;
        }

        const record = records[0] ?? null;
        const client = clients.find((item) => item.id === orderPayload.client) ?? null;
        const nextDate = record?.date ?? getTodayValue();

        setOrder(orderPayload);
        setClientSummary(client);
        setCurrentRecord(record);
        setPreviousPsoBalance(0);
        setSelectedDate(nextDate);
        setForm(
          record
            ? mapOrderRecordToForm(record, orderPayload, nextDate)
            : {
                date: nextDate,
                aviation_dr_no: orderPayload.dr_no || orderPayload.financial?.dr_no || "",
                aviation_total_due: orderPayload.order_total_due || "",
                aviation_paid: "",
                pso_dr_no: "",
                pso_consumed: "",
                pso_deposits: [],
              },
        );
      } catch (error) {
        if (active) {
          setMessage({
            type: "error",
            text: extractApiErrorMessage(error, "Unable to load order-linked balance-sheet data."),
          });
          setCurrentRecord(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOrderRecord();
    return () => {
      active = false;
    };
  }, [isOrderMode, orderId]);

  const depositTotal = form.pso_deposits.reduce((sum, deposit) => sum + parseAmount(deposit.amount), 0);
  const aviationBalance = parseAmount(form.aviation_total_due) - parseAmount(form.aviation_paid);
  const psoDeposited = previousPsoBalance + depositTotal;
  const psoBalance = psoDeposited - parseAmount(form.pso_consumed);
  const orderHasFinancialDue = Boolean(order?.order_total_due);

  function updateDepositRow(key: string, field: keyof Omit<DepositForm, "key">, value: string) {
    setForm((current) => ({
      ...current,
      pso_deposits: current.pso_deposits.map((deposit) =>
        deposit.key === key ? { ...deposit, [field]: value } : deposit,
      ),
    }));
  }

  function addDepositRow() {
    setForm((current) => ({
      ...current,
      pso_deposits: [...current.pso_deposits, createDepositForm(current.date)],
    }));
  }

  function removeDepositRow(key: string) {
    setForm((current) => ({
      ...current,
      pso_deposits: current.pso_deposits.filter((deposit) => deposit.key !== key),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    if (isOrderMode && order && !orderHasFinancialDue) {
      setSaving(false);
      setMessage({ type: "error", text: "Save financials for this order first so total due can be calculated." });
      return;
    }

    const usedDeposits = form.pso_deposits.filter(
      (deposit) => deposit.amount.trim() !== "" || deposit.date.trim() !== "" || deposit.cheque_number.trim() !== "",
    );

    if (!isOrderMode) {
      const hasInvalidDeposit = usedDeposits.some(
        (deposit) => deposit.amount.trim() === "" || deposit.date.trim() === "" || parseAmount(deposit.amount) <= 0,
      );
      if (hasInvalidDeposit) {
        setSaving(false);
        setMessage({ type: "error", text: "Each PSO deposit needs a positive amount and a date." });
        return;
      }
    }

    try {
      const payload: BalanceSheetPayload = {
        date: form.date,
        order: order?.id,
        aviation_dr_no: form.aviation_dr_no,
        aviation_total_due: form.aviation_total_due,
        aviation_paid: form.aviation_paid,
        pso_dr_no: isOrderMode ? "" : form.pso_dr_no,
        pso_consumed: isOrderMode ? "0" : form.pso_consumed,
        pso_deposits: isOrderMode
          ? []
          : usedDeposits.map((deposit) => ({
              amount: deposit.amount,
              date: deposit.date,
              cheque_number: deposit.cheque_number,
            })),
      };

      const savedRecord = currentRecord
        ? await updateBalanceSheet(currentRecord.id, payload)
        : await createBalanceSheet(payload);

      setCurrentRecord(savedRecord);
      if (isOrderMode && order) {
        const clients = await fetchClients();
        setClientSummary(clients.find((item) => item.id === order.client) ?? null);
        setForm(mapOrderRecordToForm(savedRecord, order, savedRecord.date));
      } else {
        setForm(mapDailyRecordToForm(savedRecord, previousPsoBalance));
      }
      setMessage({
        type: "success",
        text: currentRecord ? "Balance sheet updated." : "Balance sheet created.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Unable to save the balance sheet. Check the date and numeric values."),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">{isOrderMode ? "Order Balance Sheet" : "Balance Sheet"}</Typography>
        <Typography color="text.secondary">
          {isOrderMode
            ? "Track collection against a specific order DR number. Paid amounts update the client-level billed, paid, and due totals."
            : "Record daily aviation and PSO balances. PSO deposits are stored as history and the running deposited amount is calculated automatically."}
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      {isOrderMode && order && (
        <>
          {!orderHasFinancialDue && (
            <Alert severity="warning">
              This order does not have completed financials yet. Save financials first so total due can auto-fill from the order.
            </Alert>
          )}

          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <SummaryCard
              label="Order"
              value={order.ser_no}
              caption={`${order.client_name} | ${order.flight} | DR ${order.dr_no || "--"}`}
            />
            <SummaryCard
              label="Order Due"
              value={formatBalance(form.aviation_total_due || 0)}
              caption={`Paid ${formatBalance(form.aviation_paid || 0)} | Balance ${formatBalance(aviationBalance)}`}
            />
            <SummaryCard
              label="Client Totals"
              value={formatBalance(clientSummary?.total_due || 0)}
              caption={`Billed ${formatBalance(clientSummary?.total_billed || 0)} | Paid ${formatBalance(clientSummary?.total_paid || 0)}`}
            />
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button component={Link} to={`/financials/${order.id}`} variant="outlined">
              Open Financials
            </Button>
            <Button component={Link} to="/balance-sheet/overview" variant="outlined">
              Open Balance Overview
            </Button>
          </Stack>
        </>
      )}

      {!isOrderMode && (
        <Card>
          <CardContent>
            <Stack spacing={0.75}>
              <Typography variant="overline">Selected Date</Typography>
              <Typography variant="h6">{form.date}</Typography>
              <Typography variant="body2" color="text.secondary">
                Carried PSO balance from previous record: {formatBalance(previousPsoBalance)}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        <SectionCard
          title="Aviation"
          description={
            isOrderMode
              ? "DR number is tied to the selected order, and total due follows the saved financials. Enter the amount received against this order."
              : "Enter aviation DR number, due, and paid values. Aviation balance is calculated automatically."
          }
        >
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            }}
          >
            <TextField
              label={isOrderMode ? "Payment Date" : "Date"}
              type="date"
              value={form.date}
              onChange={(event) => {
                const nextValue = event.target.value;
                setSelectedDate(nextValue);
                setForm((current) => ({ ...current, date: nextValue }));
              }}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="DR Number"
              value={form.aviation_dr_no}
              onChange={(event) => setForm((current) => ({ ...current, aviation_dr_no: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Total Due"
              type="number"
              value={form.aviation_total_due}
              onChange={(event) => setForm((current) => ({ ...current, aviation_total_due: event.target.value }))}
              InputProps={{ readOnly: isOrderMode }}
              fullWidth
            />
            <TextField
              label="Paid"
              type="number"
              value={form.aviation_paid}
              onChange={(event) => setForm((current) => ({ ...current, aviation_paid: event.target.value }))}
              fullWidth
            />
            <TextField label="Balance" value={formatBalance(aviationBalance)} InputProps={{ readOnly: true }} fullWidth />
          </Box>
        </SectionCard>

        {!isOrderMode && (
          <SectionCard title="PSO" description="Add deposit entries with amount, date, and cheque number. The deposited and balance fields use the carried forward PSO balance automatically.">
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
                  value={form.date}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSelectedDate(nextValue);
                    setForm((current) => ({ ...current, date: nextValue }));
                  }}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="DR Number"
                  value={form.pso_dr_no}
                  onChange={(event) => setForm((current) => ({ ...current, pso_dr_no: event.target.value }))}
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
                          Add each PSO deposit separately so cheque and date history stays attached to the balance sheet.
                        </Typography>
                      </Box>
                      <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={addDepositRow}>
                        Add Deposit
                      </Button>
                    </Stack>

                    {form.pso_deposits.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        No deposits added for this date yet.
                      </Typography>
                    )}

                    {form.pso_deposits.map((deposit) => (
                      <Box
                        key={deposit.key}
                        sx={{
                          display: "grid",
                          gap: 2,
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr auto" },
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
                          label="Cheque Number"
                          value={deposit.cheque_number}
                          onChange={(event) => updateDepositRow(deposit.key, "cheque_number", event.target.value)}
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
                <TextField label="Deposits Added" value={formatBalance(depositTotal)} InputProps={{ readOnly: true }} fullWidth />
                <TextField label="Deposited" value={formatBalance(psoDeposited)} InputProps={{ readOnly: true }} fullWidth />
                <TextField
                  label="Consumed"
                  type="number"
                  value={form.pso_consumed}
                  onChange={(event) => setForm((current) => ({ ...current, pso_consumed: event.target.value }))}
                  fullWidth
                />
                <TextField label="Balance" value={formatBalance(psoBalance)} InputProps={{ readOnly: true }} fullWidth />
              </Box>
            </Stack>
          </SectionCard>
        )}

        <Stack direction="row" justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={saving || loading || (isOrderMode && !orderHasFinancialDue)}>
            {saving
              ? "Saving..."
              : currentRecord
                ? isOrderMode
                  ? "Update Order Balance"
                  : "Update Balance Sheet"
                : isOrderMode
                  ? "Save Order Balance"
                  : "Save Balance Sheet"}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
