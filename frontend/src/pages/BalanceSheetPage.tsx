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
import { useAuth } from "../context/AuthContext";
import type { BalanceSheet } from "../types";

type BalanceSheetForm = BalanceSheetPayload;

const emptyForm = {
  date: "",
  aviation_total_due: "",
  aviation_paid: "",
  pso_deposited: "",
  pso_consumed: "",
};

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

function mapRecordToForm(record: BalanceSheet): BalanceSheetForm {
  return {
    date: record.date,
    aviation_total_due: record.aviation_total_due,
    aviation_paid: record.aviation_paid,
    pso_deposited: record.pso_deposited,
    pso_consumed: record.pso_consumed,
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
  const { user } = useAuth();
  const [form, setForm] = useState<BalanceSheetForm>({ ...emptyForm, date: getTodayValue() });
  const [currentRecord, setCurrentRecord] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;

    async function loadForDate() {
      setLoading(true);
      setMessage(null);
      try {
        const records = await listBalanceSheets({ date: form.date });
        if (!active) {
          return;
        }
        const record = records[0] ?? null;
        setCurrentRecord(record);
        if (record) {
          setForm(mapRecordToForm(record));
        } else {
          setForm((current) => ({
            ...emptyForm,
            date: current.date,
          }));
        }
      } catch {
        if (active) {
          setMessage({ type: "error", text: "Unable to load balance sheet data for the selected date." });
          setCurrentRecord(null);
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

  const aviationBalance = parseAmount(form.aviation_total_due) - parseAmount(form.aviation_paid);
  const psoBalance = parseAmount(form.pso_deposited) - parseAmount(form.pso_consumed);
  const recordedBy = currentRecord?.created_by_username ?? user?.username ?? "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload: BalanceSheetPayload = {
        date: form.date,
        aviation_total_due: form.aviation_total_due,
        aviation_paid: form.aviation_paid,
        pso_deposited: form.pso_deposited,
        pso_consumed: form.pso_consumed,
      };

      const savedRecord = currentRecord
        ? await updateBalanceSheet(currentRecord.id, payload)
        : await createBalanceSheet(payload);

      setCurrentRecord(savedRecord);
      setForm(mapRecordToForm(savedRecord));
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
          Record daily aviation and PSO balances. Date defaults to today and the recording admin is stored automatically.
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={0.75}>
              <Typography variant="overline">Selected Date</Typography>
              <Typography variant="h6">{form.date}</Typography>
            </Stack>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Stack spacing={0.75}>
              <Typography variant="overline">Recorded By</Typography>
              <Typography variant="h6">{recordedBy || "Admin"}</Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        <SectionCard title="Aviation" description="Enter the aviation due and paid figures. Balance is calculated automatically.">
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
            <TextField label="User" value={recordedBy} InputProps={{ readOnly: true }} fullWidth />
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

        <SectionCard title="PSO" description="Enter deposited and consumed values. PSO balance is also calculated automatically.">
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
            <TextField label="User" value={recordedBy} InputProps={{ readOnly: true }} fullWidth />
            <TextField
              label="Deposited"
              type="number"
              value={form.pso_deposited}
              onChange={(event) => setForm((current) => ({ ...current, pso_deposited: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Consumed"
              type="number"
              value={form.pso_consumed}
              onChange={(event) => setForm((current) => ({ ...current, pso_consumed: event.target.value }))}
              fullWidth
            />
            <TextField label="Balance" value={formatBalance(psoBalance)} InputProps={{ readOnly: true }} fullWidth />
          </Box>
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
