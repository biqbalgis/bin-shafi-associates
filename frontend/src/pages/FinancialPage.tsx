import EmailRoundedIcon from "@mui/icons-material/EmailRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import {
  Autocomplete,
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

import { fetchCompanyProfile } from "../api/companyProfile";
import { approveFinancial, createFinancial, generateInvoice, sendFinancialInvoiceEmail, updateFinancial } from "../api/financials";
import { fetchClients } from "../api/dropdowns";
import { getOrder } from "../api/orders";
import { listSavedEmailContacts } from "../api/orders";
import type { Client, CompanyProfile, Financial, Order, SavedEmailContact } from "../types";

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
const COMPANY_LOGO_PATH = "/binshafi-logo.png";
const DEFAULT_COMPANY_NAME = "Bin Shafi Associates Private Limited";

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

function calculateTotal(price: number | null, fuelingCharges: string, gst: number | null) {
  const numericFuelingCharges = parseNumeric(fuelingCharges);
  if (price === null && numericFuelingCharges === null && gst === null) {
    return null;
  }
  return (price ?? 0) + (numericFuelingCharges ?? 0) + (gst ?? 0);
}

function buildClientInvoicePrefix(clientName: string | undefined, clientCode?: string | undefined) {
  const compactCode = (clientCode || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (compactCode && compactCode.length <= 3 && !compactCode.startsWith("CL")) {
    return compactCode;
  }
  const words = (clientName || "").match(/[A-Za-z0-9]+/g) ?? [];
  if (words.length === 0) {
    return "INV";
  }
  if (words.length === 1) {
    return words[0].toUpperCase().slice(0, 3) || "INV";
  }
  return words
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("") || "INV";
}

function generateBsaInvoice(orderSerNo: string | undefined, clientName: string | undefined, orderDate?: string | undefined, clientCode?: string | undefined) {
  const prefix = buildClientInvoicePrefix(clientName, clientCode);
  const match = (orderSerNo || "").match(/^ORD-(\d{8})-(\d+)$/);
  if (match) {
    return `${prefix}-${match[1].slice(2)}-${String(Number(match[2]))}`;
  }
  if (!orderDate) {
    return prefix;
  }
  const compactDate = orderDate.replaceAll("-", "").slice(2);
  return `${prefix}-${compactDate || "000000"}-1`;
}

function buildInvoiceFields(order: Order, financial: Financial): InvoiceField[] {
  return [
    { label: "Invoice Number", value: financial.bsa_invoice || generateBsaInvoice(order.ser_no, order.client_name, order.date) || "--" },
    { label: "Date", value: formatDate(financial.approved_at || financial.updated_at || order.date) },
    { label: "DR Number", value: financial.dr_no || order.dr_no || "--" },
    { label: "Qty", value: formatMoney(order.quantity_ltrs) },
    { label: "Rate", value: formatMoney(financial.bsa_rate) },
    { label: "Fuel Charges", value: formatMoney(financial.bsa_fueling_charges) },
    { label: "GST", value: formatMoney(financial.bsa_gst) },
    { label: "Total", value: formatMoney(financial.bsa_total_price) },
  ];
}

function buildFinancialInvoiceEmailSubject(order: Order, financial: Financial) {
  const invoiceNo = financial.bsa_invoice || generateBsaInvoice(order.ser_no, order.client_name, order.date);
  return `Invoice PDF: ${invoiceNo}`;
}

function buildFinancialInvoiceEmailBody(order: Order, financial: Financial) {
  const invoiceNo = financial.bsa_invoice || generateBsaInvoice(order.ser_no, order.client_name, order.date);
  return [
    "Please find the attached invoice PDF.",
    "",
    `Invoice No: ${invoiceNo}`,
    `Invoice Date: ${formatDate(financial.approved_at || financial.updated_at || order.date)}`,
    `Order No: ${order.ser_no}`,
    `Client: ${order.client_name}`,
    `DR No: ${financial.dr_no || order.dr_no || "--"}`,
    `Quantity (Ltrs): ${formatMoney(order.quantity_ltrs)}`,
    `Total Amount: ${formatMoney(financial.bsa_total_price)}`,
    "",
    "Regards,",
    "Bin Shafi Aviation Fuel System",
  ].join("\n");
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

function getImageFormatFromDataUrl(dataUrl: string) {
  return dataUrl.includes("image/jpeg") ? "JPEG" : "PNG";
}

function drawWrappedRightAlignedText(doc: InstanceType<typeof import("jspdf").jsPDF>, lines: string[], x: number, y: number, maxWidth: number, lineHeight: number) {
  let currentY = y;
  lines.forEach((line) => {
    const wrappedLines = doc.splitTextToSize(line, maxWidth);
    wrappedLines.forEach((wrappedLine: string) => {
      doc.text(wrappedLine, x, currentY, { align: "right" });
      currentY += lineHeight;
    });
  });
  return currentY;
}

export default function FinancialPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoiceClient, setInvoiceClient] = useState<Client | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [savedFinancial, setSavedFinancial] = useState<Financial | null>(null);
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [invoiceActionLoading, setInvoiceActionLoading] = useState<"" | "approve" | "generate">("");
  const [savedEmailContacts, setSavedEmailContacts] = useState<SavedEmailContact[]>([]);
  const [invoiceEmailDialogOpen, setInvoiceEmailDialogOpen] = useState(false);
  const [sendingInvoiceEmail, setSendingInvoiceEmail] = useState(false);
  const [invoiceEmailPreview, setInvoiceEmailPreview] = useState({
    to_email: "",
    subject: "",
    body: "",
  });
  const [form, setForm] = useState<FinancialForm>(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchCompanyProfile()
      .then((payload) => setCompanyProfile(payload))
      .catch(() => setCompanyProfile(null));
  }, []);

  useEffect(() => {
    listSavedEmailContacts()
      .then((payload) => setSavedEmailContacts(payload))
      .catch(() => setSavedEmailContacts([]));
  }, []);

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
            bsa_invoice: payload.financial.bsa_invoice || generateBsaInvoice(payload.ser_no, payload.client_name, payload.date),
            bsa_rate: payload.financial.bsa_rate ?? "",
            bsa_fueling_charges: payload.financial.bsa_fueling_charges ?? FIXED_FUELING_CHARGES,
          });
        } else {
          setForm((current) => ({
            ...current,
            dr_no: payload.dr_no,
            fueling_charges: FIXED_FUELING_CHARGES,
            bsa_invoice: generateBsaInvoice(payload.ser_no, payload.client_name, payload.date),
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
  const psoTotalPrice = calculateTotal(psoPrice, form.fueling_charges, psoGst);
  const bsaTotalPrice = calculateTotal(bsaPrice, form.bsa_fueling_charges, bsaGst);
  const profitPreview = ((bsaPrice ?? 0) - (psoPrice ?? 0)).toFixed(2);
  const activeFinancial = savedFinancial ?? order?.financial ?? null;
  const canGenerateInvoice = Boolean(order && activeFinancial);
  const isInvoiceGenerated = Boolean(activeFinancial?.invoice_generated_at);
  const isInvoiceLocked = Boolean(activeFinancial?.is_locked);

  const invoiceFields = order && activeFinancial ? buildInvoiceFields(order, activeFinancial) : [];
  const companyHeader = {
    name: companyProfile?.company_name || DEFAULT_COMPANY_NAME,
    address: companyProfile?.address || "Address not configured",
    phone: companyProfile?.phone || "Phone not configured",
    email: companyProfile?.email || "Email not configured",
  };
  const clientHeader = {
    name: invoiceClient?.name || order?.client_name || "Client not configured",
    address: invoiceClient?.address || "Address not configured",
    phone: invoiceClient?.contact_phone || "Phone not configured",
    email: invoiceClient?.contact_email || "Email not configured",
  };
  const signatureImageSrc = companyProfile?.signature_image || "";
  const invoiceAttachmentName = `${activeFinancial?.bsa_invoice || (order ? generateBsaInvoice(order.ser_no, order.client_name, order.date) : "invoice")}.pdf`;

  function syncFinancialState(response: Financial) {
    setSavedFinancial(response);
    setOrder((current) => (current ? { ...current, financial: response, dr_no: response.dr_no || current.dr_no } : current));
    setForm((current) => ({
      ...current,
      dr_no: response.dr_no || current.dr_no,
      digital_invoice: response.digital_invoice || current.digital_invoice,
      pso_invoice: response.pso_invoice || current.pso_invoice,
      pso_rate: response.pso_rate ?? "",
      fueling_charges: response.fueling_charges ?? FIXED_FUELING_CHARGES,
      bsa_invoice: response.bsa_invoice || current.bsa_invoice,
      bsa_rate: response.bsa_rate ?? "",
      bsa_fueling_charges: response.bsa_fueling_charges ?? FIXED_FUELING_CHARGES,
    }));
  }

  async function persistFinancial(showSuccessMessage = true) {
    if (!order) {
      return null;
    }
    setSavingFinancial(true);
    try {
      const payload = {
        order: order.id,
        ...form,
        bsa_invoice: generateBsaInvoice(order.ser_no, order.client_name, order.date),
        pso_price: formatDerivedAmount(psoPrice),
        bsa_price: formatDerivedAmount(bsaPrice),
      };
      const financialId = savedFinancial?.id ?? order.financial?.id;
      const response = financialId
        ? await updateFinancial(financialId, payload)
        : await createFinancial(payload);
      syncFinancialState(response);
      if (showSuccessMessage) {
      setSuccess("Financials saved. You can now preview the invoice or download the PDF.");
      }
      return response;
    } catch {
      setError("Unable to save financials. Confirm order state and numeric values.");
      return null;
    } finally {
      setSavingFinancial(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    await persistFinancial();
  }

  async function handleApproveInvoice() {
    if (!order) {
      return;
    }
    setError("");
    setSuccess("");
    const persisted = await persistFinancial(false);
    if (!persisted) {
      return;
    }
    setInvoiceActionLoading("approve");
    try {
      const response = await approveFinancial(persisted.id);
      syncFinancialState(response);
      setSuccess("Invoice approved and locked.");
    } catch {
      setError("Unable to approve the invoice.");
    } finally {
      setInvoiceActionLoading("");
    }
  }

  async function handleGenerateInvoice() {
    if (!activeFinancial) {
      return;
    }
    if (activeFinancial.invoice_generated_at) {
      return;
    }

    setError("");
    setSuccess("");
    setInvoiceActionLoading("generate");
    try {
      const response = await generateInvoice(activeFinancial.id);
      syncFinancialState(response);
      setInvoicePreviewOpen(true);
      setSuccess("Invoice generated. You can download the PDF any time.");
    } catch {
      setError("Unable to generate the invoice.");
    } finally {
      setInvoiceActionLoading("");
    }
  }

  function openInvoiceEmailDialog() {
    if (!order || !activeFinancial) {
      return;
    }
    const defaultRecipient = invoiceClient?.contact_email || savedEmailContacts[0]?.email || "";
    setError("");
    setSuccess("");
    setInvoiceEmailPreview({
      to_email: defaultRecipient,
      subject: buildFinancialInvoiceEmailSubject(order, activeFinancial),
      body: buildFinancialInvoiceEmailBody(order, activeFinancial),
    });
    setInvoiceEmailDialogOpen(true);
  }

  async function handleSendInvoiceEmail() {
    if (!order || !activeFinancial || !invoiceEmailPreview.to_email.trim()) {
      setError("Select a receipt email before sending the invoice.");
      return;
    }

    setSendingInvoiceEmail(true);
    setError("");
    setSuccess("");
    try {
      const response = await sendFinancialInvoiceEmail(activeFinancial.id, invoiceEmailPreview);
      syncFinancialState(response);
      setSuccess(`Invoice email sent to ${invoiceEmailPreview.to_email}.`);
      setInvoiceEmailDialogOpen(false);
    } catch {
      setError("Unable to send the invoice email.");
    } finally {
      setSendingInvoiceEmail(false);
    }
  }

  async function handleDownloadInvoicePdf() {
    if (!order || !activeFinancial || !isInvoiceGenerated) {
      return;
    }
    setDownloadingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const logoDataUrl = await loadImageAsDataUrl(COMPANY_LOGO_PATH);
      const signatureDataUrl = signatureImageSrc
        ? await loadImageAsDataUrl(signatureImageSrc).catch(() => "")
        : "";
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 16;
      let cursorY = 18;

      doc.addImage(logoDataUrl, "PNG", margin, cursorY - 6, 28, 28);
      const companyBlockY = cursorY + 28;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(companyHeader.name, margin, companyBlockY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const companyLines = [
        `Address: ${companyHeader.address}`,
        `Phone: ${companyHeader.phone}`,
        `Email: ${companyHeader.email}`,
      ];
      let companyBottomY = companyBlockY + 6;
      companyLines.forEach((line) => {
        const wrappedLines = doc.splitTextToSize(line, 78);
        doc.text(wrappedLines, margin, companyBottomY);
        companyBottomY += wrappedLines.length * 5;
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Client Details", pageWidth - margin, cursorY + 2, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const clientBottomY = drawWrappedRightAlignedText(
        doc,
        [
          `Name: ${clientHeader.name}`,
          `Email: ${clientHeader.email}`,
          `Address: ${clientHeader.address}`,
          `Phone: ${clientHeader.phone}`,
        ],
        pageWidth - margin,
        cursorY + 9,
        78,
        5,
      );

      cursorY = Math.max(companyBottomY, clientBottomY, cursorY + 22) + 6;
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

      if (signatureDataUrl) {
        doc.addImage(
          signatureDataUrl,
          getImageFormatFromDataUrl(signatureDataUrl),
          pageWidth - margin - 66,
          cursorY - 17,
          66,
          15,
        );
      }
      doc.setLineWidth(0.4);
      doc.line(margin, cursorY, margin + 70, cursorY);
      doc.line(pageWidth - margin - 70, cursorY, pageWidth - margin, cursorY);
      doc.setFont("helvetica", "normal");
      doc.text("Prepared By", margin, cursorY + 6);
      doc.text("Authorized Signature", pageWidth - margin, cursorY + 6, { align: "right" });

      doc.save(`${activeFinancial.bsa_invoice || generateBsaInvoice(order.ser_no, order.client_name, order.date) || "invoice"}.pdf`);
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
        {isInvoiceLocked && activeFinancial && (
          <Alert severity="info">
            Invoice is approved and read only. Approved on {formatDate(activeFinancial.approved_at)} by {activeFinancial.approved_by_name || "an admin"}. Use Admin Setup to unlock it for editing.
          </Alert>
        )}

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
                  <TextField
                    label="DR No"
                    value={form.dr_no}
                    onChange={(event) => setForm((current) => ({ ...current, dr_no: event.target.value }))}
                    fullWidth
                    disabled={isInvoiceLocked}
                  />
                </Box>
                <Box>
                  <TextField
                    label="Digital DR"
                    value={form.digital_invoice}
                    onChange={(event) => setForm((current) => ({ ...current, digital_invoice: event.target.value }))}
                    fullWidth
                    disabled={isInvoiceLocked}
                  />
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
                    <TextField
                      label="PSO Invoice"
                      value={form.pso_invoice}
                      onChange={(event) => setForm((current) => ({ ...current, pso_invoice: event.target.value }))}
                      fullWidth
                      disabled={isInvoiceLocked}
                    />
                  </Box>
                  <Box>
                    <TextField
                      label="PSO Rate"
                      type="number"
                      value={form.pso_rate}
                      onChange={(event) => setForm((current) => ({ ...current, pso_rate: event.target.value }))}
                      fullWidth
                      disabled={isInvoiceLocked}
                    />
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
                    <TextField
                      label="BSA Price / Rate"
                      type="number"
                      value={form.bsa_rate}
                      onChange={(event) => setForm((current) => ({ ...current, bsa_rate: event.target.value }))}
                      fullWidth
                      disabled={isInvoiceLocked}
                    />
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
                {!isInvoiceLocked && (
                  <>
                    <Button type="submit" variant="contained" disabled={savingFinancial || isInvoiceLocked}>
                      {savingFinancial ? "Saving..." : "Save Financials"}
                    </Button>
                    {activeFinancial && (
                      <Button
                        variant="outlined"
                        onClick={handleApproveInvoice}
                        disabled={savingFinancial || invoiceActionLoading === "approve"}
                      >
                        {invoiceActionLoading === "approve" ? "Approving..." : "Approve Invoice"}
                      </Button>
                    )}
                  </>
                )}
                {canGenerateInvoice && (
                  <Button
                    variant="outlined"
                    startIcon={<ReceiptLongRoundedIcon />}
                    onClick={() => void handleGenerateInvoice()}
                    disabled={invoicePreviewOpen || invoiceActionLoading === "generate" || isInvoiceGenerated}
                  >
                    {isInvoiceGenerated
                      ? "Invoice Generated"
                      : invoiceActionLoading === "generate"
                        ? "Generating..."
                        : "Generate Invoice"}
                  </Button>
                )}
                {canGenerateInvoice && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={handleDownloadInvoicePdf}
                    disabled={downloadingPdf || !isInvoiceGenerated}
                  >
                    {downloadingPdf ? "Generating PDF..." : "Download PDF"}
                  </Button>
                )}
                {canGenerateInvoice && (
                  <Button
                    variant="outlined"
                    startIcon={<EmailRoundedIcon />}
                    onClick={openInvoiceEmailDialog}
                    disabled={sendingInvoiceEmail || invoiceActionLoading === "generate"}
                  >
                    Email Invoice
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
                    display: "grid",
                    gap: 3,
                    gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
                    alignItems: "start",
                  }}
                >
                  <Stack spacing={1.5} alignItems="flex-start">
                    <Box
                      component="img"
                      src={COMPANY_LOGO_PATH}
                      alt="Bin Shafi logo"
                      sx={{ width: 120, height: "auto", objectFit: "contain" }}
                    />
                    <Stack spacing={0.5}>
                      <Typography variant="h6">{companyHeader.name}</Typography>
                      <Typography color="text.secondary">{companyHeader.address}</Typography>
                      <Typography color="text.secondary">Phone: {companyHeader.phone}</Typography>
                      <Typography color="text.secondary">Email: {companyHeader.email}</Typography>
                    </Stack>
                  </Stack>
                  <Stack spacing={0.5} sx={{ textAlign: { xs: "left", sm: "right" }, alignItems: { xs: "flex-start", sm: "flex-end" } }}>
                    <Typography variant="overline" color="text.secondary">
                      Client Details
                    </Typography>
                    <Typography variant="h6">{clientHeader.name}</Typography>
                    <Typography color="text.secondary">Email: {clientHeader.email}</Typography>
                    <Typography color="text.secondary">Address: {clientHeader.address}</Typography>
                    <Typography color="text.secondary">Phone: {clientHeader.phone}</Typography>
                  </Stack>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="h5">Generated Invoice</Typography>
                  <Typography color="text.secondary">
                    Invoice preview for {activeFinancial.bsa_invoice || generateBsaInvoice(order.ser_no, order.client_name, order.date)}
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
                    <Box
                      sx={{
                        borderBottom: "1px solid rgba(24,49,83,0.4)",
                        height: 64,
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: { xs: "flex-start", sm: "flex-end" },
                        pb: 0.75,
                      }}
                    >
                      {signatureImageSrc && (
                        <Box
                          component="img"
                          src={signatureImageSrc}
                          alt="Authorized signature"
                          sx={{ maxWidth: 180, maxHeight: 52, objectFit: "contain" }}
                        />
                      )}
                    </Box>
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
        </DialogActions>
      </Dialog>

      <Dialog open={invoiceEmailDialogOpen} onClose={() => setInvoiceEmailDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Send Invoice Email</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {savedEmailContacts.length === 0 && (
              <Alert severity="info">No saved receipt emails found. Type the recipient address manually.</Alert>
            )}
            <Autocomplete
              freeSolo
              options={savedEmailContacts.map((contact) => contact.email)}
              value={invoiceEmailPreview.to_email}
              inputValue={invoiceEmailPreview.to_email}
              onChange={(_event, newValue) => {
                setInvoiceEmailPreview((current) => ({
                  ...current,
                  to_email: newValue || "",
                }));
              }}
              onInputChange={(_event, newInputValue) => {
                setInvoiceEmailPreview((current) => ({
                  ...current,
                  to_email: newInputValue,
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Receipt Email"
                  type="email"
                  helperText="Select a saved email or type a new address."
                  fullWidth
                />
              )}
            />
            <TextField
              label="Subject"
              value={invoiceEmailPreview.subject}
              onChange={(event) => setInvoiceEmailPreview((current) => ({ ...current, subject: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email Body"
              value={invoiceEmailPreview.body}
              onChange={(event) => setInvoiceEmailPreview((current) => ({ ...current, body: event.target.value }))}
              fullWidth
              multiline
              minRows={14}
            />
            <Alert severity="info">PDF attachment: {invoiceAttachmentName}</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInvoiceEmailDialogOpen(false)} disabled={sendingInvoiceEmail}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSendInvoiceEmail()}
            variant="contained"
            disabled={sendingInvoiceEmail || !invoiceEmailPreview.to_email.trim()}
          >
            {sendingInvoiceEmail ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
