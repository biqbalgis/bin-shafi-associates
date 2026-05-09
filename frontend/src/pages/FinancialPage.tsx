import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
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
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { createFinancial, updateFinancial } from "../api/financials";
import { fetchClients } from "../api/dropdowns";
import { getOrder } from "../api/orders";
import type { Client, Financial, Order } from "../types";

type FinancialForm = {
  dr_no: string;
  digital_invoice: string;
  pso_invoice: string;
  pso_rate: string;
  fueling_charges: string;
  bsa_invoice: string;
  bsa_rate: string;
  bsa_fueling_charges: string;
};

type InvoiceField = {
  label: string;
  value: string;
};

const FIXED_FUELING_CHARGES = "5100.00";
const COMPANY_NAME = "Bin Shafi Associates Private Limited";
const COMPANY_LOGO_PATH = "/binshafi-logo.png";

const emptyForm: FinancialForm = {
  dr_no: "",
  digital_invoice: "",
  pso_invoice: "",
  pso_rate: "",
  fueling_charges: FIXED_FUELING_CHARGES,
  bsa_invoice: "",
  bsa_rate: "",
  bsa_fueling_charges: FIXED_FUELING_CHARGES,
};

function formatDerivedAmount(value: number | null) {
  return value === null ? "" : value.toFixed(2);
}

function parseNumeric(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? null : numericValue;
}

function formatMoney(value: string | number | null | undefined) {
  const numericValue = parseNumeric(value);
  return numericValue === null ? "--" : numericValue.toFixed(2);
}

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

function calculatePrice(rate: string, quantity: string | undefined) {
  const numericRate = parseNumeric(rate);
  const numericQuantity = parseNumeric(quantity);
  if (numericRate === null || numericQuantity === null) {
    return null;
  }
  return numericRate * numericQuantity;
}

function calculateGst(price: number | null) {
  if (price === null) {
    return null;
  }
  return price * 0.18;
}

function calculateTotal(price: number | null, gst: number | null) {
  if (price === null && gst === null) {
    return null;
  }
  return (price ?? 0) + (gst ?? 0);
}

function generateBsaInvoice(orderSerNo: string | undefined) {
  if (!orderSerNo) {
    return "";
  }
  return orderSerNo.startsWith("ORD-") ? `BSA-${orderSerNo.slice(4)}` : `BSA-${orderSerNo}`;
}

function buildInvoiceFields(order: Order, financial: Financial): InvoiceField[] {
  return [
    { label: "Invoice Number", value: financial.bsa_invoice || generateBsaInvoice(order.ser_no) || "--" },
    { label: "Date", value: formatDate(financial.updated_at || order.date) },
    { label: "DR Number", value: financial.dr_no || order.dr_no || "--" },
    { label: "Qty", value: formatMoney(order.quantity_ltrs) },
    { label: "Rate", value: formatMoney(financial.bsa_rate) },
    { label: "Fuel Charges", value: formatMoney(financial.bsa_fueling_charges) },
    { label: "GST", value: formatMoney(financial.bsa_gst) },
    { label: "Total", value: formatMoney(financial.bsa_total_price) },
  ];
}

async function loadImageAsDataUrl(path: string) {
  const response = await fetch(path);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(blob);
  });
}

export default function FinancialPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoiceClient, setInvoiceClient] = useState<Client | null>(null);
  const [savedFinancial, setSavedFinancial] = useState<Financial | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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
        setSavedFinancial(payload.financial);
        if (payload.financial) {
          setForm({
            dr_no: payload.financial.dr_no || payload.dr_no,
            digital_invoice: payload.financial.digital_invoice,
            pso_invoice: payload.financial.pso_invoice,
            pso_rate: payload.financial.pso_rate ?? "",
            fueling_charges: payload.financial.fueling_charges ?? FIXED_FUELING_CHARGES,
            bsa_invoice: payload.financial.bsa_invoice || generateBsaInvoice(payload.ser_no),
            bsa_rate: payload.financial.bsa_rate ?? "",
            bsa_fueling_charges: payload.financial.bsa_fueling_charges ?? FIXED_FUELING_CHARGES,
          });
        } else {
          setForm((current) => ({
            ...current,
            dr_no: payload.dr_no,
            fueling_charges: FIXED_FUELING_CHARGES,
            bsa_invoice: generateBsaInvoice(payload.ser_no),
            bsa_fueling_charges: FIXED_FUELING_CHARGES,
          }));
        }
      })
      .catch(() => setError("Unable to load order financial data."));
  }, [params.orderId]);

  useEffect(() => {
    if (!order?.client) {
      setInvoiceClient(null);
      return;
    }
    fetchClients()
      .then((clients) => {
        setInvoiceClient(clients.find((client) => client.id === order.client) ?? null);
      })
      .catch(() => setInvoiceClient(null));
  }, [order?.client]);

  const quantity = order?.quantity_ltrs;
  const psoPrice = calculatePrice(form.pso_rate, quantity);
  const bsaPrice = calculatePrice(form.bsa_rate, quantity);
  const psoGst = calculateGst(psoPrice);
  const bsaGst = calculateGst(bsaPrice);
  const psoTotalPrice = calculateTotal(psoPrice, psoGst);
  const bsaTotalPrice = calculateTotal(bsaPrice, bsaGst);
  const profitPreview = ((bsaPrice ?? 0) - (psoPrice ?? 0)).toFixed(2);
  const activeFinancial = savedFinancial ?? order?.financial ?? null;
  const canGenerateInvoice = Boolean(order && activeFinancial);

  const invoiceFields = order && activeFinancial ? buildInvoiceFields(order, activeFinancial) : [];
  const invoiceHeader = {
    address: invoiceClient?.address || "Address not configured",
    phone: invoiceClient?.contact_phone || "Phone not configured",
    email: invoiceClient?.contact_email || "Email not configured",
  };

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
        bsa_invoice: generateBsaInvoice(order.ser_no),
        pso_price: formatDerivedAmount(psoPrice),
        bsa_price: formatDerivedAmount(bsaPrice),
      };
      const response = order.financial
        ? await updateFinancial(order.financial.id, payload)
        : await createFinancial(payload);

      setSavedFinancial(response);
      setOrder((current) => (current ? { ...current, financial: response, dr_no: response.dr_no || current.dr_no } : current));
      setForm((current) => ({
        ...current,
        dr_no: response.dr_no || current.dr_no,
        fueling_charges: response.fueling_charges ?? FIXED_FUELING_CHARGES,
        bsa_invoice: response.bsa_invoice || current.bsa_invoice,
        bsa_fueling_charges: response.bsa_fueling_charges ?? FIXED_FUELING_CHARGES,
      }));
      setSuccess("Financials saved. You can now generate the invoice preview and download the PDF.");
    } catch {
      setError("Unable to save financials. Confirm order state and numeric values.");
    }
  }

  async function handleDownloadInvoicePdf() {
    if (!order || !activeFinancial) {
      return;
    }
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const logoDataUrl = await loadImageAsDataUrl(COMPANY_LOGO_PATH);
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 16;
      let cursorY = 18;

      doc.addImage(logoDataUrl, "PNG", margin, cursorY - 6, 28, 28);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(COMPANY_NAME, 50, cursorY + 2);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const headerLines = [
        `Address: ${invoiceHeader.address}`,
        `Phone: ${invoiceHeader.phone}`,
        `Email: ${invoiceHeader.email}`,
      ];
      headerLines.forEach((line, index) => {
        const wrapped = doc.splitTextToSize(line, pageWidth - 66);
        doc.text(wrapped, 50, cursorY + 9 + index * 6);
      });

      cursorY = 56;
      doc.setDrawColor(24, 49, 83);
      doc.setLineWidth(0.6);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("Generated Invoice", margin, cursorY);
      cursorY += 10;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      invoiceFields.forEach(({ label, value }) => {
        doc.setDrawColor(220, 225, 232);
        doc.rect(margin, cursorY - 5, pageWidth - margin * 2, 10);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin + 4, cursorY + 1.5);
        doc.setFont("helvetica", "normal");
        doc.text(String(value), pageWidth - margin - 4, cursorY + 1.5, { align: "right" });
        cursorY += 10;
      });

      cursorY += 18;
      doc.setFont("helvetica", "bold");
      doc.text("Signature", margin, cursorY);
      cursorY += 18;

      doc.setLineWidth(0.4);
      doc.line(margin, cursorY, margin + 70, cursorY);
      doc.line(pageWidth - margin - 70, cursorY, pageWidth - margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text("Prepared By", margin, cursorY + 6);
      doc.text("Authorized Signature", pageWidth - margin, cursorY + 6, { align: "right" });

      doc.save(`${activeFinancial.bsa_invoice || generateBsaInvoice(order.ser_no) || "invoice"}.pdf`);
    } catch {
      setError("Unable to generate invoice PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <>
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
                    <TextField label="PSO Price" value={formatDerivedAmount(psoPrice)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="Fueling Charges" value={form.fueling_charges} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="PSO GST (18%)" value={formatDerivedAmount(psoGst)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="PSO Total Price" value={formatDerivedAmount(psoTotalPrice)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                </Box>
              </Box>

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
                    <TextField label="BSA Invoice" value={form.bsa_invoice} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="BSA Price / Rate" type="number" value={form.bsa_rate} onChange={(event) => setForm((current) => ({ ...current, bsa_rate: event.target.value }))} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="BSA Price" value={formatDerivedAmount(bsaPrice)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="BSA Fueling Charges" value={form.bsa_fueling_charges} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="BSA GST (18%)" value={formatDerivedAmount(bsaGst)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                  <Box>
                    <TextField label="BSA Total Price" value={formatDerivedAmount(bsaTotalPrice)} InputProps={{ readOnly: true }} fullWidth />
                  </Box>
                </Box>
              </Box>

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

              <Stack direction="row" spacing={2} justifyContent="flex-end" flexWrap="wrap">
                <Button variant="outlined" onClick={() => navigate("/orders")}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained">
                  Save Financials
                </Button>
                {canGenerateInvoice && (
                  <Button
                    variant="outlined"
                    startIcon={<ReceiptLongRoundedIcon />}
                    onClick={() => setInvoicePreviewOpen(true)}
                  >
                    Generate Invoice
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog
        open={invoicePreviewOpen}
        onClose={() => setInvoicePreviewOpen(false)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>Invoice Preview</DialogTitle>
        <DialogContent dividers>
          {order && activeFinancial ? (
            <Box
              sx={{
                width: "100%",
                maxWidth: 820,
                mx: "auto",
                bgcolor: "#ffffff",
                border: "1px solid rgba(24,49,83,0.1)",
                borderRadius: 3,
                p: { xs: 2.5, md: 4 },
              }}
            >
              <Stack spacing={3}>
                <Box
                  sx={{
                    display: "flex",
                    gap: 2,
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                  }}
                >
                  <Box
                    component="img"
                    src={COMPANY_LOGO_PATH}
                    alt="Bin Shafi logo"
                    sx={{ width: 120, height: "auto", objectFit: "contain" }}
                  />
                  <Stack spacing={0.5} sx={{ maxWidth: 420, textAlign: { xs: "left", md: "right" } }}>
                    <Typography variant="h6">{COMPANY_NAME}</Typography>
                    <Typography color="text.secondary">{invoiceHeader.address}</Typography>
                    <Typography color="text.secondary">Phone: {invoiceHeader.phone}</Typography>
                    <Typography color="text.secondary">Email: {invoiceHeader.email}</Typography>
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h5">Generated Invoice</Typography>
                  <Typography color="text.secondary">
                    Invoice preview for {activeFinancial.bsa_invoice || generateBsaInvoice(order.ser_no)}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                    border: "1px solid rgba(24,49,83,0.12)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {invoiceFields.map((field) => (
                    <Box
                      key={field.label}
                      sx={{
                        p: 2,
                        borderBottom: "1px solid rgba(24,49,83,0.08)",
                        borderRight: { sm: "1px solid rgba(24,49,83,0.08)" },
                        "&:nth-of-type(2n)": { borderRight: { sm: "none" } },
                        "&:nth-last-of-type(-n+2)": { borderBottom: { sm: "none" } },
                      }}
                    >
                      <Typography variant="overline" color="text.secondary">
                        {field.label}
                      </Typography>
                      <Typography variant="h6">{field.value}</Typography>
                    </Box>
                  ))}
                </Box>

                <Box
                  sx={{
                    display: "grid",
                    gap: 4,
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                    pt: 4,
                  }}
                >
                  <Box>
                    <Box sx={{ borderBottom: "1px solid rgba(24,49,83,0.4)", height: 44 }} />
                    <Typography sx={{ pt: 1 }} color="text.secondary">
                      Prepared By
                    </Typography>
                  </Box>
                  <Box>
                    <Box sx={{ borderBottom: "1px solid rgba(24,49,83,0.4)", height: 44 }} />
                    <Typography sx={{ pt: 1 }} color="text.secondary">
                      Authorized Signature
                    </Typography>
                  </Box>
                </Box>
              </Stack>
            </Box>
          ) : (
            <Typography color="text.secondary">Save financials first to preview the invoice.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoicePreviewOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadRoundedIcon />}
            onClick={handleDownloadInvoicePdf}
            disabled={!canGenerateInvoice || downloadingPdf}
          >
            {downloadingPdf ? "Generating PDF..." : "Download PDF"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
