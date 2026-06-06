import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { fetchClients } from "../api/dropdowns";
import { listFinancials } from "../api/financials";
import { buildDateRange } from "../utils/dateFilters";
import type { Client, Financial } from "../types";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value: string | null | undefined) {
  if (!value) {
    return "--";
  }
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? value : numericValue.toFixed(2);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Financial[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<"" | "draft" | "approved">("");
  const [dayFilter, setDayFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    async function loadInvoices() {
      setLoading(true);
      setError("");
      try {
        const dateRange = buildDateRange({ day: dayFilter, month: monthFilter, year: yearFilter });
        const payload = await listFinancials({
          search,
          client: client ? Number(client) : "",
          approvalStatus,
          ...dateRange,
          ordering: "-order__date",
        });
        setInvoices(payload);
      } catch {
        setError("Unable to load invoices.");
      } finally {
        setLoading(false);
      }
    }

    loadInvoices();
  }, [approvalStatus, client, dayFilter, monthFilter, yearFilter, search]);

  const sortedInvoices = [...invoices].sort((left, right) => {
    const leftOrderTime = new Date(left.order_date).getTime();
    const rightOrderTime = new Date(right.order_date).getTime();
    if (leftOrderTime !== rightOrderTime) {
      return rightOrderTime - leftOrderTime;
    }
    const leftUpdatedTime = new Date(left.approved_at || left.updated_at || left.created_at).getTime();
    const rightUpdatedTime = new Date(right.approved_at || right.updated_at || right.created_at).getTime();
    if (leftUpdatedTime !== rightUpdatedTime) {
      return rightUpdatedTime - leftUpdatedTime;
    }
    return right.id - left.id;
  });

  return (
    <Stack spacing={3}>
      <Box>
                <Typography variant="h4">All Invoices</Typography>
                <Typography color="text.secondary">
          Review all generated invoices, filter the list, and open any invoice. Results are ordered by order date and invoice update time.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.4fr) repeat(4, minmax(0, 1fr))" },
              }}
            >
              <TextField
                label="Search"
                placeholder="Invoice no, order, client, DR"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                fullWidth
              />
              <TextField label="Client" select value={client} onChange={(event) => setClient(event.target.value)} fullWidth>
                <MenuItem value="">All clients</MenuItem>
                {clients.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Status"
                select
                value={approvalStatus}
                onChange={(event) => setApprovalStatus(event.target.value as "" | "draft" | "approved")}
                fullWidth
              >
                <MenuItem value="">All invoices</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
                <MenuItem value="approved">Approved</MenuItem>
              </TextField>
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
      {loading && <Alert severity="info">Refreshing invoices...</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Invoice</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>DR No</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Profit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Approved</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInvoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography color="text.secondary">No invoices found for the selected filters.</Typography>
                </TableCell>
              </TableRow>
            )}
            {sortedInvoices.map((invoice) => (
              <TableRow key={invoice.id} hover>
                <TableCell>
                  <Typography fontWeight={700}>{invoice.bsa_invoice || "--"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    PSO {invoice.pso_invoice || "--"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography>{formatDate(invoice.order_date)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(invoice.approved_at || invoice.updated_at || invoice.created_at)}
                  </Typography>
                </TableCell>
                <TableCell>{invoice.order_ser_no}</TableCell>
                <TableCell>{invoice.client_name}</TableCell>
                <TableCell>{invoice.dr_no || "--"}</TableCell>
                <TableCell>{formatMoney(invoice.bsa_total_price)}</TableCell>
                <TableCell>{formatMoney(invoice.profit)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={invoice.is_locked ? "Approved" : "Draft"}
                    color={invoice.is_locked ? "success" : "default"}
                    variant={invoice.is_locked ? "filled" : "outlined"}
                  />
                </TableCell>
                <TableCell>{formatDate(invoice.approved_at)}</TableCell>
                <TableCell align="right">
                  <Button
                    component={Link}
                    to={`/financials/${invoice.order}`}
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNewRoundedIcon />}
                  >
                    Open Invoice
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
