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
import { Link } from "react-router-dom";

import { listBalanceSheets } from "../api/balanceSheets";
import type { BalanceSheet } from "../types";

function parseAmount(value: string | number) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatAmount(value: string | number) {
  return parseAmount(value).toFixed(2);
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
  const [orderRecords, setOrderRecords] = useState<BalanceSheet[]>([]);
  const [dailyRecords, setDailyRecords] = useState<BalanceSheet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function reloadData() {
    setLoading(true);
    setError("");
    try {
      const [ordersPayload, dailyPayload] = await Promise.all([
        listBalanceSheets({ record_type: "order" }),
        listBalanceSheets({ record_type: "daily" }),
      ]);
      setOrderRecords(ordersPayload);
      setDailyRecords(dailyPayload);
    } catch {
      setError("Unable to load balance-sheet history.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadData();
  }, []);

  const latestOrderRecord = orderRecords[0];
  const latestDailyRecord = dailyRecords[0];
  const totalOrderDue = orderRecords.reduce((sum, item) => sum + parseAmount(item.aviation_total_due), 0);
  const totalOrderPaid = orderRecords.reduce((sum, item) => sum + parseAmount(item.aviation_paid), 0);
  const totalOrderBalance = orderRecords.reduce((sum, item) => sum + parseAmount(item.aviation_balance), 0);
  const totalPsoAdded = dailyRecords.reduce(
    (sum, item) => sum + item.pso_deposits.reduce((depositSum, deposit) => depositSum + parseAmount(deposit.amount), 0),
    0,
  );
  const latestPsoBalance = latestDailyRecord ? parseAmount(latestDailyRecord.pso_balance) : 0;

  return (
    <Stack spacing={3}>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4">Balance Sheet Overview</Typography>
          <Typography color="text.secondary">
            Review order-linked collections by DR number and the separate daily PSO ledger.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => void reloadData()} disabled={loading}>
            Refresh
          </Button>
          <Button component={Link} to="/balance-sheet" variant="outlined">
            Daily Balance Sheet
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
        <SummaryCard
          label="Order Due"
          value={formatAmount(totalOrderDue)}
          caption={`Collected ${formatAmount(totalOrderPaid)} | Remaining ${formatAmount(totalOrderBalance)}`}
        />
        <SummaryCard
          label="Tracked Orders"
          value={String(orderRecords.length)}
          caption={latestOrderRecord ? `Latest order record: ${latestOrderRecord.order_ser_no}` : "No order-linked balance sheets yet."}
        />
        <SummaryCard
          label="PSO Added"
          value={formatAmount(totalPsoAdded)}
          caption={`Latest available PSO: ${formatAmount(latestDailyRecord?.pso_deposited ?? 0)} | Remaining balance: ${formatAmount(latestPsoBalance)}`}
        />
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Latest Order Collection</Typography>
              <Typography color="text.secondary">
                {latestOrderRecord
                  ? `Collection snapshot for ${latestOrderRecord.order_ser_no}.`
                  : "Save an order-linked balance sheet from the Orders screen to populate this view."}
              </Typography>
            </Box>

            {latestOrderRecord && (
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.25}>
                    <Typography variant="subtitle1">{latestOrderRecord.order_ser_no} / {latestOrderRecord.client_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      DR {latestOrderRecord.aviation_dr_no || "--"} | Paid {formatAmount(latestOrderRecord.aviation_paid)} out of {formatAmount(latestOrderRecord.aviation_total_due)}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={formatPercent(parseAmount(latestOrderRecord.aviation_paid), parseAmount(latestOrderRecord.aviation_total_due))}
                      sx={{ height: 10, borderRadius: 999 }}
                    />
                    <Typography variant="body2">Balance: {formatAmount(latestOrderRecord.aviation_balance)}</Typography>
                    {latestOrderRecord.order && (
                      <Button component={Link} to={`/balance-sheet/${latestOrderRecord.order}`} variant="outlined" sx={{ alignSelf: "flex-start" }}>
                        Open Order Balance
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Order Collections</Typography>
              <Typography color="text.secondary">
                One record per order, linked to the order DR number. Partial collections reduce the client’s overall outstanding amount.
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Order</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>DR</TableCell>
                    <TableCell align="right">Due</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Balance</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orderRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        {loading ? "Loading order-linked balances..." : "No order-linked balance-sheet records found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {orderRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{record.date}</TableCell>
                      <TableCell>{record.order_ser_no || "--"}</TableCell>
                      <TableCell>{record.client_name || "--"}</TableCell>
                      <TableCell>{record.aviation_dr_no || "--"}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_total_due)}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_paid)}</TableCell>
                      <TableCell align="right">{formatAmount(record.aviation_balance)}</TableCell>
                      <TableCell align="right">
                        {record.order ? (
                          <Button component={Link} to={`/balance-sheet/${record.order}`} size="small" variant="outlined">
                            Open
                          </Button>
                        ) : (
                          "--"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Daily PSO Ledger</Typography>
              <Typography color="text.secondary">
                Separate daily records for PSO deposits, consumption, and running balance.
              </Typography>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>PSO DR</TableCell>
                    <TableCell align="right">PSO Deposited</TableCell>
                    <TableCell align="right">PSO Consumed</TableCell>
                    <TableCell align="right">PSO Balance</TableCell>
                    <TableCell>Deposit History</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dailyRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        {loading ? "Loading daily balance sheets..." : "No daily balance-sheet records found."}
                      </TableCell>
                    </TableRow>
                  )}
                  {dailyRecords.map((record) => (
                    <TableRow key={record.id} hover>
                      <TableCell>{record.date}</TableCell>
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
