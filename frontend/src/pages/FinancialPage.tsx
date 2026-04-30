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
import { useNavigate, useParams } from "react-router-dom";

import { createFinancial, updateFinancial } from "../api/financials";
import { getOrder } from "../api/orders";
import type { Order } from "../types";

type FinancialForm = {
  dr_no: string;
  digital_invoice: string;
  pso_invoice: string;
  pso_rate: string;
  pso_price: string;
  fueling_charges: string;
  bsa_invoice: string;
  bsa_rate: string;
  bsa_price: string;
  bsa_fueling_charges: string;
};

const emptyForm: FinancialForm = {
  dr_no: "",
  digital_invoice: "",
  pso_invoice: "",
  pso_rate: "",
  pso_price: "",
  fueling_charges: "",
  bsa_invoice: "",
  bsa_rate: "",
  bsa_price: "",
  bsa_fueling_charges: "",
};

function formatDerivedAmount(value: number | null) {
  return value === null ? "" : value.toFixed(2);
}

function calculateGst(price: string) {
  const numericPrice = Number(price);
  if (!price || Number.isNaN(numericPrice)) {
    return null;
  }
  return numericPrice * 0.18;
}

function calculateTotal(price: string, charges: string, gst: number | null) {
  const numericPrice = Number(price || 0);
  const numericCharges = Number(charges || 0);
  if (!price && !charges && gst === null) {
    return null;
  }
  return numericPrice + numericCharges + (gst ?? 0);
}

export default function FinancialPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<FinancialForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!params.orderId) {
      return;
    }
    getOrder(Number(params.orderId))
      .then((payload) => {
        setOrder(payload);
        if (payload.financial) {
          setForm({
            dr_no: payload.financial.dr_no || payload.dr_no,
            digital_invoice: payload.financial.digital_invoice,
            pso_invoice: payload.financial.pso_invoice,
            pso_rate: payload.financial.pso_rate ?? "",
            pso_price: payload.financial.pso_price ?? "",
            fueling_charges: payload.financial.fueling_charges ?? "",
            bsa_invoice: payload.financial.bsa_invoice,
            bsa_rate: payload.financial.bsa_rate ?? "",
            bsa_price: payload.financial.bsa_price ?? "",
            bsa_fueling_charges: payload.financial.bsa_fueling_charges ?? "",
          });
        } else {
          setForm((current) => ({ ...current, dr_no: payload.dr_no }));
        }
      })
      .catch(() => setError("Unable to load order financial data."));
  }, [params.orderId]);

  const psoGst = calculateGst(form.pso_price);
  const bsaGst = calculateGst(form.bsa_price);
  const psoTotalPrice = calculateTotal(form.pso_price, form.fueling_charges, psoGst);
  const bsaTotalPrice = calculateTotal(form.bsa_price, form.bsa_fueling_charges, bsaGst);
  const profitPreview = ((bsaTotalPrice ?? 0) - (psoTotalPrice ?? 0)).toFixed(2);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      const payload = {
        order: order.id,
        ...form,
      };
      if (order.financial) {
        await updateFinancial(order.financial.id, payload);
      } else {
        await createFinancial(payload);
      }
      setSuccess("Financials saved. Completed status updates only when financial closure is complete.");
      setTimeout(() => navigate("/orders"), 900);
    } catch {
      setError("Unable to save financials. Confirm order state and numeric values.");
    }
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Financial Closure</Typography>
        <Typography color="text.secondary">
          Attach DR and invoice values for {order?.ser_no ?? "selected order"}. Profit is computed automatically.
        </Typography>
      </div>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card>
        <CardContent>
          <Stack component="form" spacing={3} onSubmit={handleSubmit}>
            {/* Common Fields */}
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              <Box>
                <TextField label="DR No" value={form.dr_no} onChange={(event) => setForm((current) => ({ ...current, dr_no: event.target.value }))} fullWidth />
              </Box>
              <Box>
                <TextField label="Digital DR" value={form.digital_invoice} onChange={(event) => setForm((current) => ({ ...current, digital_invoice: event.target.value }))} fullWidth />
              </Box>
              <Box>
                <TextField label="Quantity" value={order?.quantity_ltrs ?? ""} InputProps={{ readOnly: true }} fullWidth />
              </Box>
            </Box>

            {/* PSO Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                PSO
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                }}
              >
                <Box>
                  <TextField label="PSO Invoice" value={form.pso_invoice} onChange={(event) => setForm((current) => ({ ...current, pso_invoice: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="PSO Rate" type="number" value={form.pso_rate} onChange={(event) => setForm((current) => ({ ...current, pso_rate: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="PSO Price" type="number" value={form.pso_price} onChange={(event) => setForm((current) => ({ ...current, pso_price: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="Fueling Charges" type="number" value={form.fueling_charges} onChange={(event) => setForm((current) => ({ ...current, fueling_charges: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="PSO GST (18%)" value={formatDerivedAmount(psoGst)} InputProps={{ readOnly: true }} fullWidth />
                </Box>
                <Box>
                  <TextField label="PSO Total Price" value={formatDerivedAmount(psoTotalPrice)} InputProps={{ readOnly: true }} fullWidth />
                </Box>
              </Box>
            </Box>

            {/* BSA Section */}
            <Box>
              <Typography variant="h6" gutterBottom>
                BSA
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                }}
              >
                <Box>
                  <TextField label="BSA Invoice" value={form.bsa_invoice} onChange={(event) => setForm((current) => ({ ...current, bsa_invoice: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="BSA Rate" type="number" value={form.bsa_rate} onChange={(event) => setForm((current) => ({ ...current, bsa_rate: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="BSA Price" type="number" value={form.bsa_price} onChange={(event) => setForm((current) => ({ ...current, bsa_price: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="BSA Fueling Charges" type="number" value={form.bsa_fueling_charges} onChange={(event) => setForm((current) => ({ ...current, bsa_fueling_charges: event.target.value }))} fullWidth />
                </Box>
                <Box>
                  <TextField label="BSA GST (18%)" value={formatDerivedAmount(bsaGst)} InputProps={{ readOnly: true }} fullWidth />
                </Box>
                <Box>
                  <TextField label="BSA Total Price" value={formatDerivedAmount(bsaTotalPrice)} InputProps={{ readOnly: true }} fullWidth />
                </Box>
              </Box>
            </Box>

            {/* Profit Preview */}
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              }}
            >
              <Box>
                <TextField label="Profit Preview" value={profitPreview} InputProps={{ readOnly: true }} fullWidth />
              </Box>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate("/orders")}>
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                Save Financials
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
