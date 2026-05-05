import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { listBalanceSheets } from "../api/balanceSheets";
import type { BalanceSheet } from "../types";

function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatAmount(value: string | number) {
  const numeric = typeof value === "number" ? value : parseAmount(value);
  return numeric.toFixed(2);
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

function formatDepositSummary(record: BalanceSheet) {
  if (record.pso_deposits.length === 0) {
    return "--";
  }
  return record.pso_deposits
    .map((deposit) => `${deposit.date}: ${formatAmount(deposit.amount)}${deposit.cheque_number ? ` (${deposit.cheque_number})` : ""}`)
    .join(" | ");
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

export default function BalanceSheetOverviewPage() {
  const [records, setRecords] = useState<BalanceSheet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reloadData() {
    setLoading(true);
    setError("");
    try {
      const payload = await listBalanceSheets();
      setRecords(payload);
    } catch {
      setError("Unable to load balance-sheet history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadData();
  }, []);

  const latestRecord = records[0];
  const totalAviationDue = records.reduce((sum, item) => sum + parseAmount(item.aviation_total_due), 0);
  const totalAviationBalance = records.reduce((sum, item) => sum + parseAmount(item.aviation_balance), 0);
  const totalPsoAdded = records.reduce(
    (sum, item) => sum + item.pso_deposits.reduce((depositSum, deposit) => depositSum + parseAmount(deposit.amount), 0),
    0,
  );
  const latestPsoBalance = latestRecord ? parseAmount(latestRecord.pso_balance) : 0;

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Balance Sheet Overview</Typography>
          <Typography color="text.secondary">
            Review stored aviation and PSO balances, including DR numbers and PSO deposit history.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void reloadData()} disabled={loading}>
          Refresh
        </Button>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <SummaryCard
          label="Records"
          value={String(records.length)}
          caption={latestRecord ? `Latest entry: ${latestRecord.date}` : "No records yet."}
        />
        <SummaryCard
          label="Aviation Due"
          value={formatAmount(totalAviationDue)}
          caption={`Open aviation balance: ${formatAmount(totalAviationBalance)}`}
        />
        <SummaryCard
          label="PSO Added"
          value={formatAmount(totalPsoAdded)}
          caption={`Latest available PSO: ${formatAmount(latestRecord?.pso_deposited ?? 0)} | Remaining balance: ${formatAmount(latestPsoBalance)}`}
        />
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Latest Snapshot</Typography>
              <Typography color="text.secondary">
                {latestRecord
                  ? `Captured on ${latestRecord.date}.`
                  : "Create the first balance-sheet record to populate this view."}
              </Typography>
            </Box>

            {latestRecord && (
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1">Aviation Collection</Typography>
                      <Typography variant="body2" color="text.secondary">
                        DR {latestRecord.aviation_dr_no || "--"} | Paid {formatAmount(latestRecord.aviation_paid)} out of {formatAmount(latestRecord.aviation_total_due)}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={formatPercent(parseAmount(latestRecord.aviation_paid), parseAmount(latestRecord.aviation_total_due))}
                        sx={{ height: 10, borderRadius: 999 }}
                      />
                      <Typography variant="body2">Balance: {formatAmount(latestRecord.aviation_balance)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>

                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1">PSO Utilization</Typography>
                      <Typography variant="body2" color="text.secondary">
                        DR {latestRecord.pso_dr_no || "--"} | Consumed {formatAmount(latestRecord.pso_consumed)} out of {formatAmount(latestRecord.pso_deposited)}
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={formatPercent(parseAmount(latestRecord.pso_consumed), parseAmount(latestRecord.pso_deposited))}
                        sx={{ height: 10, borderRadius: 999 }}
                        color="secondary"
                      />
                      <Typography variant="body2">Balance: {formatAmount(latestRecord.pso_balance)}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">History</Typography>
              <Typography color="text.secondary">
                Daily balance-sheet records with aviation and PSO figures plus deposit history.
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Aviation DR</TableCell>
                    <TableCell align="right">Aviation Due</TableCell>
                    <TableCell align="right">Aviation Paid</TableCell>
                    <TableCell align="right">Aviation Balance</TableCell>
                    <TableCell>PSO DR</TableCell>
                    <TableCell align="right">PSO Deposited</TableCell>
                    <TableCell align="right">PSO Consumed</TableCell>
                    <TableCell align="right">PSO Balance</TableCell>
                    <TableCell>Deposit History</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} align="center">
                        {loading ? "Loading balance sheets..." : "No balance-sheet records found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {records.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{record.aviation_dr_no || "--"}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_total_due)}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_paid)}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_balance)}</TableCell>
                      <TableCell>{record.pso_dr_no || "--"}</TableCell>
                      <TableCell align="right">{formatAmount(record.pso_deposited)}</TableCell>
                      <TableCell align="right">{formatAmount(record.pso_consumed)}</TableCell>
                      <TableCell align="right">{formatAmount(record.pso_balance)}</TableCell>
                      <TableCell>{formatDepositSummary(record)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
