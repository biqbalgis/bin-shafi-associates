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
import { useEffect, useState } from "react";

import {
  createBalanceSheet,
  listBalanceSheets,
  updateBalanceSheet,
  type BalanceSheetPayload,
} from "../api/balanceSheets";
import type { BalanceSheet, PsoDeposit } from "../types";

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

function parseAmount(value: string) {
  if (value.trim() === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatBalance(value: number) {
  return value.toFixed(2);
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

function mapRecordToForm(record: BalanceSheet, previousPsoBalance: number): BalanceSheetForm {
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

export default function BalanceSheetPage() {
  const [form, setForm] = useState<BalanceSheetForm>(() => emptyForm(getTodayValue()));
  const [currentRecord, setCurrentRecord] = useState<BalanceSheet | null>(null);
  const [previousPsoBalance, setPreviousPsoBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadForDate() {
      setLoading(true);
      setMessage(null);
      try {
        const records = await listBalanceSheets({ date_to: form.date });
        if (!active) {
          return;
        }

        const exactRecord = records.find((record) => record.date === form.date) ?? null;
        const previousRecord = exactRecord
          ? records.find((record) => record.date < form.date) ?? null
          : records[0] ?? null;
        const openingBalance = previousRecord ? parseAmount(previousRecord.pso_balance) : 0;

        setPreviousPsoBalance(openingBalance);
        setCurrentRecord(exactRecord);
        setForm(exactRecord ? mapRecordToForm(exactRecord, openingBalance) : emptyForm(form.date));
      } catch {
        if (active) {
          setMessage({ type: "error", text: "Unable to load balance sheet data for the selected date." });
          setCurrentRecord(null);
          setPreviousPsoBalance(0);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadForDate();

    return () => {
      active = false;
    };
  }, [form.date]);

  const depositTotal = form.pso_deposits.reduce((sum, deposit) => sum + parseAmount(deposit.amount), 0);
  const aviationBalance = parseAmount(form.aviation_total_due) - parseAmount(form.aviation_paid);
  const psoDeposited = previousPsoBalance + depositTotal;
  const psoBalance = psoDeposited - parseAmount(form.pso_consumed);

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

    const usedDeposits = form.pso_deposits.filter(
      (deposit) => deposit.amount.trim() !== "" || deposit.date.trim() !== "" || deposit.cheque_number.trim() !== "",
    );

    const hasInvalidDeposit = usedDeposits.some(
      (deposit) => deposit.amount.trim() === "" || deposit.date.trim() === "" || parseAmount(deposit.amount) <= 0,
    );

    if (hasInvalidDeposit) {
      setSaving(false);
      setMessage({ type: "error", text: "Each PSO deposit needs a positive amount and a date." });
      return;
    }

    try {
      const payload: BalanceSheetPayload = {
        date: form.date,
        aviation_dr_no: form.aviation_dr_no,
        aviation_total_due: form.aviation_total_due,
        aviation_paid: form.aviation_paid,
        pso_dr_no: form.pso_dr_no,
        pso_consumed: form.pso_consumed,
        pso_deposits: usedDeposits.map((deposit) => ({
          amount: deposit.amount,
          date: deposit.date,
          cheque_number: deposit.cheque_number,
        })),
      };

      const savedRecord = currentRecord
        ? await updateBalanceSheet(currentRecord.id, payload)
        : await createBalanceSheet(payload);

      setCurrentRecord(savedRecord);
      setForm(mapRecordToForm(savedRecord, previousPsoBalance));
      setMessage({
        type: "success",
        text: currentRecord ? "Balance sheet updated." : "Balance sheet created.",
      });
    } catch {
      setMessage({ type: "error", text: "Unable to save the balance sheet. Check the date and numeric values." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Balance Sheet</Typography>
        <Typography color="text.secondary">
          Record aviation and PSO balances by date. PSO deposits are stored as history and the running deposited amount is calculated automatically.
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

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

      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        <SectionCard title="Aviation" description="Enter aviation DR number, due, and paid values. Aviation balance is calculated automatically.">
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
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
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
                onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
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
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1.5}>
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

        <Stack direction="row" justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={saving || loading}>
            {saving ? "Saving..." : currentRecord ? "Update Balance Sheet" : "Save Balance Sheet"}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
