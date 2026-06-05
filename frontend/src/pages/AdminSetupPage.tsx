import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAircraft,
  createAirport,
  createClient,
  createFlightOption,
  createFuelCategory,
  createFuelType,
  createRouteOption,
} from "../api/adminSetup";
import { fetchCompanyProfile, updateCompanyProfile, updateCompanySignature } from "../api/companyProfile";
import {
  fetchAircrafts,
  fetchAirports,
  fetchClients,
  fetchFlightOptions,
  fetchFuelCategories,
  fetchFuelTypes,
  fetchRouteOptions,
} from "../api/dropdowns";
import { listFinancials, unlockFinancial } from "../api/financials";
import { createSavedEmailContact, listSavedEmailContacts } from "../api/orders";
import type {
  Aircraft,
  Airport,
  Client,
  CompanyProfile,
  Financial,
  FlightOption,
  FuelCategory,
  FuelType,
  RouteOption,
  SavedEmailContact,
} from "../types";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          </Box>
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AdminSetupPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [fuelCategories, setFuelCategories] = useState<FuelCategory[]>([]);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [approvedInvoices, setApprovedInvoices] = useState<Financial[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [unlockingInvoice, setUnlockingInvoice] = useState(false);
  const [savedEmailContacts, setSavedEmailContacts] = useState<SavedEmailContact[]>([]);
  const [orderMailEmails, setOrderMailEmails] = useState([""]);
  const [savingOrderMail, setSavingOrderMail] = useState(false);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  const [clientForm, setClientForm] = useState({
    name: "",
    code: "",
    contact_email: "",
    contact_phone: "",
    address: "",
  });
  const [aircraftForm, setAircraftForm] = useState({
    client: "",
    registration_no: "",
    aircraft_model: "",
    manufacturer: "",
  });
  const [airportForm, setAirportForm] = useState({
    code: "",
    name: "",
    city: "",
    country: "",
  });
  const [fuelTypeForm, setFuelTypeForm] = useState({ name: "", description: "" });
  const [fuelCategoryForm, setFuelCategoryForm] = useState({ name: "", description: "" });
  const [flightForm, setFlightForm] = useState({ code: "", description: "" });
  const [routeForm, setRouteForm] = useState({ name: "", description: "" });
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    address: "",
    phone: "",
    email: "",
  });

  async function reloadData() {
    try {
      const [
        clientsData,
        aircraftsData,
        airportsData,
        fuelTypesData,
        fuelCategoriesData,
        flightsData,
        routesData,
        companyProfileData,
        approvedInvoicesData,
        savedEmailContactsData,
      ] =
        await Promise.all([
          fetchClients(),
          fetchAircrafts(),
          fetchAirports(),
          fetchFuelTypes(),
          fetchFuelCategories(),
          fetchFlightOptions(),
          fetchRouteOptions(),
          fetchCompanyProfile(),
          listFinancials({ approvalStatus: "approved" }),
          listSavedEmailContacts(),
        ]);

      setClients(clientsData);
      setAircrafts(aircraftsData);
      setAirports(airportsData);
      setFuelTypes(fuelTypesData);
      setFuelCategories(fuelCategoriesData);
      setFlights(flightsData);
      setRoutes(routesData);
      setCompanyProfile(companyProfileData);
      setApprovedInvoices(approvedInvoicesData);
      setSavedEmailContacts(savedEmailContactsData);
      setSelectedInvoiceId((current) => {
        if (current && approvedInvoicesData.some((invoice) => String(invoice.id) === current)) {
          return current;
        }
        return approvedInvoicesData[0] ? String(approvedInvoicesData[0].id) : "";
      });
      setCompanyForm({
        company_name: companyProfileData.company_name || "",
        address: companyProfileData.address || "",
        phone: companyProfileData.phone || "",
        email: companyProfileData.email || "",
      });
    } catch {
      setMessage({ type: "error", text: "Failed to load setup data." });
    }
  }

  const selectedInvoice = approvedInvoices.find((invoice) => String(invoice.id) === selectedInvoiceId) ?? null;

  useEffect(() => {
    void reloadData();
  }, []);

  async function handleAction(action: () => Promise<unknown>, successText: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ type: "success", text: successText });
    } catch {
      setMessage({ type: "error", text: "Request failed. Check required fields and uniqueness." });
    }
  }

  async function handleSaveOrderMailEmails() {
    const existingEmails = new Set(savedEmailContacts.map((contact) => contact.email.toLowerCase()));
    const nextEmails = Array.from(
      new Set(orderMailEmails.map((email) => email.trim().toLowerCase()).filter(Boolean))
    ).filter((email) => !existingEmails.has(email));

    if (nextEmails.length === 0) {
      setMessage({ type: "error", text: "Enter at least one new email address that is not already saved." });
      return;
    }

    setSavingOrderMail(true);
    setMessage(null);
    try {
      for (const email of nextEmails) {
        await createSavedEmailContact({ email });
      }
      setOrderMailEmails([""]);
      await reloadData();
      setMessage({ type: "success", text: "Order mail recipients saved." });
    } catch {
      setMessage({ type: "error", text: "Unable to save one or more email addresses." });
    } finally {
      setSavingOrderMail(false);
    }
  }

  async function handleSaveSignature() {
    if (!signatureFile) {
      setMessage({ type: "error", text: "Choose a signature image before saving." });
      return;
    }

    setSavingSignature(true);
    setMessage(null);
    try {
      const savedProfile = await updateCompanySignature(signatureFile);
      setCompanyProfile(savedProfile);
      setSignatureFile(null);
      setMessage({ type: "success", text: "Authorized signature saved." });
    } catch {
      setMessage({ type: "error", text: "Unable to save the signature image." });
    } finally {
      setSavingSignature(false);
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">Admin Setup</Typography>
        <Typography color="text.secondary">
          Add master data for order creation. These values appear in Create Order dropdowns.
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}

      <SectionCard title="Company Profile" description="These details appear on the login page and generated invoices.">
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          <TextField
            label="Company Name"
            value={companyForm.company_name}
            onChange={(e) => setCompanyForm((v) => ({ ...v, company_name: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Phone"
            value={companyForm.phone}
            onChange={(e) => setCompanyForm((v) => ({ ...v, phone: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Email"
            value={companyForm.email}
            onChange={(e) => setCompanyForm((v) => ({ ...v, email: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Address"
            value={companyForm.address}
            onChange={(e) => setCompanyForm((v) => ({ ...v, address: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
            sx={{ gridColumn: { md: "1 / -1" } }}
          />
        </Box>
        <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
          <Typography variant="body2" color="text.secondary">
            {companyProfile ? "Saved company details are loaded above." : "Company profile will be created on first save."}
          </Typography>
          <Button
            variant="contained"
            onClick={() =>
              void handleAction(async () => {
                const savedProfile = await updateCompanyProfile(companyForm);
                setCompanyProfile(savedProfile);
                setCompanyForm({
                  company_name: savedProfile.company_name || "",
                  address: savedProfile.address || "",
                  phone: savedProfile.phone || "",
                  email: savedProfile.email || "",
                });
              }, "Company profile saved.")
            }
          >
            Save Company Details
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard title="Authorized Signature" description="Upload the signature image used on generated invoices.">
        <Stack spacing={2}>
          {companyProfile?.signature_image ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Current signature
              </Typography>
              <Box
                component="img"
                src={companyProfile.signature_image}
                alt="Authorized signature"
                sx={{
                  width: 240,
                  maxWidth: "100%",
                  height: 96,
                  objectFit: "contain",
                  border: "1px solid rgba(24,49,83,0.16)",
                  borderRadius: 1,
                  bgcolor: "#ffffff",
                  p: 1,
                }}
              />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No signature image uploaded yet.
            </Typography>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button variant="outlined" component="label">
              Choose Signature
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="body2" color="text.secondary">
              {signatureFile ? signatureFile.name : "PNG, JPG, or JPEG. Max 2MB."}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              onClick={() => void handleSaveSignature()}
              disabled={!signatureFile || savingSignature}
            >
              {savingSignature ? "Saving..." : "Save Signature"}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title="Invoice Controls" description="Unlock an approved invoice here before editing it.">
        <Stack spacing={2}>
          <TextField
            label="Approved Invoice"
            select
            value={selectedInvoiceId}
            onChange={(e) => setSelectedInvoiceId(e.target.value)}
            fullWidth
          >
            {approvedInvoices.length === 0 && <MenuItem value="">No approved invoices</MenuItem>}
            {approvedInvoices.map((invoice) => (
              <MenuItem key={invoice.id} value={invoice.id}>
                {invoice.bsa_invoice} / {invoice.client_name} / {invoice.order_ser_no}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {selectedInvoice
              ? `${selectedInvoice.client_name} | ${selectedInvoice.order_ser_no} | Approved ${new Date(selectedInvoice.approved_at || selectedInvoice.updated_at).toLocaleString()}`
              : "Select an approved invoice to unlock it for editing."}
          </Typography>
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant="contained"
              disabled={!selectedInvoice || unlockingInvoice}
              onClick={() =>
                void handleAction(async () => {
                  if (!selectedInvoice) {
                    return;
                  }
                  setUnlockingInvoice(true);
                  try {
                    await unlockFinancial(selectedInvoice.id);
                    await reloadData();
                    navigate(`/financials/${selectedInvoice.order}`);
                  } finally {
                    setUnlockingInvoice(false);
                  }
                }, "Invoice unlocked. Redirecting to the invoice editor.")
              }
            >
              {unlockingInvoice ? "Unlocking..." : "Edit Invoice"}
            </Button>
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard title="Order Mail" description="Save recipient emails used when sending pending order details.">
        <Stack spacing={2}>
          {orderMailEmails.map((email, index) => (
            <TextField
              key={index}
              label={`Email ${index + 1}`}
              type="email"
              value={email}
              onChange={(event) =>
                setOrderMailEmails((current) =>
                  current.map((value, itemIndex) => (itemIndex === index ? event.target.value : value))
                )
              }
              fullWidth
            />
          ))}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
            <Button variant="outlined" onClick={() => setOrderMailEmails((current) => [...current, ""])}>
              Add Another Email
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSaveOrderMailEmails()}
              disabled={savingOrderMail || orderMailEmails.every((email) => !email.trim())}
            >
              {savingOrderMail ? "Saving..." : "Save Emails"}
            </Button>
          </Stack>
          <Divider />
          <Box>
            <Typography variant="subtitle1">Saved Emails ({savedEmailContacts.length})</Typography>
            <Stack spacing={0.75} sx={{ mt: 1 }}>
              {savedEmailContacts.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No order mail recipients saved yet.
                </Typography>
              )}
              {savedEmailContacts.map((contact) => (
                <Typography key={contact.id} variant="body2">
                  {contact.email}
                </Typography>
              ))}
            </Stack>
          </Box>
        </Stack>
      </SectionCard>

      <SectionCard title="Clients" description="Create client companies first.">
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          <TextField label="Client Name" value={clientForm.name} onChange={(e) => setClientForm((v) => ({ ...v, name: e.target.value }))} fullWidth />
          <TextField label="Client Code" value={clientForm.code} onChange={(e) => setClientForm((v) => ({ ...v, code: e.target.value }))} fullWidth />
          <TextField label="Contact Email" value={clientForm.contact_email} onChange={(e) => setClientForm((v) => ({ ...v, contact_email: e.target.value }))} fullWidth />
          <TextField label="Contact Phone" value={clientForm.contact_phone} onChange={(e) => setClientForm((v) => ({ ...v, contact_phone: e.target.value }))} fullWidth />
          <TextField label="Address" value={clientForm.address} onChange={(e) => setClientForm((v) => ({ ...v, address: e.target.value }))} fullWidth multiline minRows={2} />
        </Box>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createClient(clientForm);
              setClientForm({ name: "", code: "", contact_email: "", contact_phone: "", address: "" });
              await reloadData();
            }, "Client created.")
          }
        >
          Add Client
        </Button>
      </SectionCard>

      <SectionCard title="Aircraft" description="Each aircraft must belong to a client.">
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          <TextField
            label="Client"
            select
            value={aircraftForm.client}
            onChange={(e) => setAircraftForm((v) => ({ ...v, client: e.target.value }))}
            fullWidth
          >
            {clients.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Registration No" value={aircraftForm.registration_no} onChange={(e) => setAircraftForm((v) => ({ ...v, registration_no: e.target.value }))} fullWidth />
          <TextField label="Aircraft Model" value={aircraftForm.aircraft_model} onChange={(e) => setAircraftForm((v) => ({ ...v, aircraft_model: e.target.value }))} fullWidth />
          <TextField label="Manufacturer" value={aircraftForm.manufacturer} onChange={(e) => setAircraftForm((v) => ({ ...v, manufacturer: e.target.value }))} fullWidth />
        </Box>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createAircraft({ ...aircraftForm, client: Number(aircraftForm.client) });
              setAircraftForm({ client: "", registration_no: "", aircraft_model: "", manufacturer: "" });
              await reloadData();
            }, "Aircraft created.")
          }
        >
          Add Aircraft
        </Button>
      </SectionCard>

      <SectionCard title="Airport / Route Base" description="Airports are used directly in order dropdowns.">
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          <TextField label="Airport Code" value={airportForm.code} onChange={(e) => setAirportForm((v) => ({ ...v, code: e.target.value }))} fullWidth />
          <TextField label="Airport Name" value={airportForm.name} onChange={(e) => setAirportForm((v) => ({ ...v, name: e.target.value }))} fullWidth />
          <TextField label="City" value={airportForm.city} onChange={(e) => setAirportForm((v) => ({ ...v, city: e.target.value }))} fullWidth />
          <TextField label="Country" value={airportForm.country} onChange={(e) => setAirportForm((v) => ({ ...v, country: e.target.value }))} fullWidth />
        </Box>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createAirport(airportForm);
              setAirportForm({ code: "", name: "", city: "", country: "" });
              await reloadData();
            }, "Airport created.")
          }
        >
          Add Airport
        </Button>
      </SectionCard>

      <SectionCard title="Fuel Type" description="Populate fuel type dropdown.">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Fuel Type Name" value={fuelTypeForm.name} onChange={(e) => setFuelTypeForm((v) => ({ ...v, name: e.target.value }))} fullWidth />
          <TextField label="Description" value={fuelTypeForm.description} onChange={(e) => setFuelTypeForm((v) => ({ ...v, description: e.target.value }))} fullWidth />
        </Stack>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createFuelType(fuelTypeForm);
              setFuelTypeForm({ name: "", description: "" });
              await reloadData();
            }, "Fuel type created.")
          }
        >
          Add Fuel Type
        </Button>
      </SectionCard>

      <SectionCard title="Fuel Category" description="Populate fuel category dropdown.">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Fuel Category Name" value={fuelCategoryForm.name} onChange={(e) => setFuelCategoryForm((v) => ({ ...v, name: e.target.value }))} fullWidth />
          <TextField label="Description" value={fuelCategoryForm.description} onChange={(e) => setFuelCategoryForm((v) => ({ ...v, description: e.target.value }))} fullWidth />
        </Stack>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createFuelCategory(fuelCategoryForm);
              setFuelCategoryForm({ name: "", description: "" });
              await reloadData();
            }, "Fuel category created.")
          }
        >
          Add Fuel Category
        </Button>
      </SectionCard>

      <SectionCard title="Flight" description="Populate flight dropdown for order creation.">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Flight Code" value={flightForm.code} onChange={(e) => setFlightForm((v) => ({ ...v, code: e.target.value }))} fullWidth />
          <TextField label="Description" value={flightForm.description} onChange={(e) => setFlightForm((v) => ({ ...v, description: e.target.value }))} fullWidth />
        </Stack>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createFlightOption(flightForm);
              setFlightForm({ code: "", description: "" });
              await reloadData();
            }, "Flight added.")
          }
        >
          Add Flight
        </Button>
      </SectionCard>

      <SectionCard title="Route" description="Populate route dropdown for order creation.">
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField label="Route Name" value={routeForm.name} onChange={(e) => setRouteForm((v) => ({ ...v, name: e.target.value }))} fullWidth />
          <TextField label="Description" value={routeForm.description} onChange={(e) => setRouteForm((v) => ({ ...v, description: e.target.value }))} fullWidth />
        </Stack>
        <Button
          variant="contained"
          onClick={() =>
            void handleAction(async () => {
              await createRouteOption(routeForm);
              setRouteForm({ name: "", description: "" });
              await reloadData();
            }, "Route added.")
          }
        >
          Add Route
        </Button>
      </SectionCard>

      <SectionCard title="Created Data" description="All active records currently available for dropdowns.">
        <Stack direction="row" justifyContent="flex-end">
          <Button variant="outlined" onClick={() => void reloadData()}>
            Refresh Data
          </Button>
        </Stack>

        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" } }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Clients ({clients.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {clients.length === 0 && <Typography color="text.secondary">No clients yet.</Typography>}
                {clients.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.name} ({item.code})
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Aircrafts ({aircrafts.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {aircrafts.length === 0 && <Typography color="text.secondary">No aircrafts yet.</Typography>}
                {aircrafts.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.registration_no} / {item.aircraft_model} / {item.client_name}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Airports ({airports.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {airports.length === 0 && <Typography color="text.secondary">No airports yet.</Typography>}
                {airports.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.code} / {item.name}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Fuel Types ({fuelTypes.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {fuelTypes.length === 0 && <Typography color="text.secondary">No fuel types yet.</Typography>}
                {fuelTypes.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.name}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Fuel Categories ({fuelCategories.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {fuelCategories.length === 0 && <Typography color="text.secondary">No fuel categories yet.</Typography>}
                {fuelCategories.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.name}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Flights ({flights.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {flights.length === 0 && <Typography color="text.secondary">No flights yet.</Typography>}
                {flights.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.code}{item.description ? ` / ${item.description}` : ""}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1">Routes ({routes.length})</Typography>
              <Divider sx={{ my: 1 }} />
              <Stack spacing={0.75}>
                {routes.length === 0 && <Typography color="text.secondary">No routes yet.</Typography>}
                {routes.map((item) => (
                  <Typography key={item.id} variant="body2">
                    {item.name}{item.description ? ` / ${item.description}` : ""}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </SectionCard>
    </Stack>
  );
}
