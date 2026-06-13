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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  createAircraft,
  createAirport,
  createClient,
  createFlightOption,
  createFuelType,
  createRouteOption,
} from "../api/adminSetup";
import {
  fetchAircrafts,
  fetchAirports,
  fetchClients,
  fetchFlightOptions,
  fetchFuelTypes,
  fetchRouteOptions,
} from "../api/dropdowns";
import { createOrder, sendOrderEmail } from "../api/orders";
import { useAuth } from "../context/AuthContext";
import type { Aircraft, Airport, Client, FlightOption, FuelType, Order, RouteOption } from "../types";

type FormState = {
  date: string;
  flight: string;
  flight_status: "DOMESTIC" | "INTERNATIONAL";
  client: string;
  aircraft: string;
  airport: string;
  route: string;
  fuel_type: string;
  quantity_ltrs: string;
};

type DialogKind = "client" | "aircraft" | "airport" | "fuelType" | "flight" | "route" | null;

const initialForm: FormState = {
  date: new Date().toISOString().slice(0, 10),
  flight: "",
  flight_status: "DOMESTIC",
  client: "",
  aircraft: "",
  airport: "",
  route: "",
  fuel_type: "",
  quantity_ltrs: "",
};

const emptyClientForm = {
  name: "",
  code: "",
  contact_email: "",
  contact_phone: "",
  address: "",
};

const emptyAircraftForm = {
  registration_no: "",
  aircraft_model: "",
  manufacturer: "",
};

const emptyAirportForm = {
  code: "",
  name: "",
  city: "",
  country: "",
};

const emptyFuelTypeForm = {
  name: "",
  description: "",
};

const emptyFlightForm = {
  code: "",
  description: "",
};

const emptyRouteForm = {
  name: "",
  description: "",
};

function buildOrderEmailSubject(order: Order) {
  return `Order PDF: ${order.ser_no}`;
}

function buildOrderEmailBody(order: Order) {
  return [
    "Please find the attached order PDF.",
    "",
    `Serial No: ${order.ser_no}`,
    `Date: ${new Date(order.date).toLocaleDateString()}`,
    `Flight: ${order.flight}`,
    `Client: ${order.client_name}`,
    `Aircraft: ${order.aircraft_registration}`,
    `Airport: ${order.airport_name}`,
    `Route: ${order.route}`,
    `Fuel Type: ${order.fuel_type_name}`,
    `Quantity (Ltrs): ${Number(order.quantity_ltrs).toLocaleString()}`,
  ].join("\n");
}

export default function CreateOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isLinkedCustomer = user?.role === "CUSTOMER" && Boolean(user.client);
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    client: user?.client ? String(user.client) : "",
  }));
  const [clients, setClients] = useState<Client[]>([]);
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreview, setEmailPreview] = useState({
    to_email: "",
    subject: "",
    body: "",
  });
  const [dialogKind, setDialogKind] = useState<DialogKind>(null);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [aircraftForm, setAircraftForm] = useState(emptyAircraftForm);
  const [airportForm, setAirportForm] = useState(emptyAirportForm);
  const [fuelTypeForm, setFuelTypeForm] = useState(emptyFuelTypeForm);
  const [flightForm, setFlightForm] = useState(emptyFlightForm);
  const [routeForm, setRouteForm] = useState(emptyRouteForm);

  async function loadMasterData() {
    const [clientsData, airportsData, fuelTypesData, flightsData, routesData] = await Promise.all([
      fetchClients(),
      fetchAirports(),
      fetchFuelTypes(),
      fetchFlightOptions(),
      fetchRouteOptions(),
    ]);
    if (isLinkedCustomer && user?.client) {
      setClients(clientsData.filter((client) => client.id === user.client));
    } else {
      setClients(clientsData);
    }
    setAirports(airportsData);
    setFuelTypes(fuelTypesData);
    setFlights(flightsData);
    setRoutes(routesData);
  }

  async function loadAircraftOptions(clientId?: string) {
    const selectedClient = clientId || form.client || user?.client?.toString();
    if (!selectedClient) {
      setAircrafts([]);
      return;
    }
    const payload = await fetchAircrafts(Number(selectedClient));
    setAircrafts(payload);
  }

  useEffect(() => {
    loadMasterData().catch(() => setError("Unable to load form dropdowns."));
  }, [isLinkedCustomer, user?.client]);

  useEffect(() => {
    loadAircraftOptions(form.client).catch(() => setError("Unable to load aircrafts for the selected client."));
  }, [form.client, user?.client]);

  function closeDialog() {
    setDialogKind(null);
  }

  function openSendEmailDialog(order: Order) {
    const defaultRecipient = clients.find((client) => client.id === order.client)?.contact_email || "";
    setEmailPreview({
      to_email: defaultRecipient,
      subject: buildOrderEmailSubject(order),
      body: buildOrderEmailBody(order),
    });
    setEmailDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.flight || !form.flight_status || !form.airport || !form.route || !form.fuel_type || !form.quantity_ltrs) {
      setError("Complete all required fields before submitting.");
      return;
    }

    try {
      const createdOrderPayload = await createOrder({
        date: form.date,
        flight: form.flight,
        flight_status: form.flight_status,
        client: form.client ? Number(form.client) : undefined,
        aircraft: form.aircraft ? Number(form.aircraft) : null,
        airport: Number(form.airport),
        route: form.route,
        fuel_type: Number(form.fuel_type),
        quantity_ltrs: form.quantity_ltrs,
      });
      setCreatedOrder(createdOrderPayload);
      setSuccess("Order created successfully. You can send it as a PDF by email now.");
    } catch {
      setError("Order creation failed. Check your data and permissions.");
    }
  }

  async function handleSendEmail() {
    if (!createdOrder) {
      return;
    }
    setSendingEmail(true);
    setError("");
    try {
      await sendOrderEmail(createdOrder.id, emailPreview);
      setSuccess(`Order email sent to ${emailPreview.to_email}.`);
      setEmailDialogOpen(false);
    } catch {
      setError("Unable to send the order email.");
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleCreateClient() {
    try {
      const created = await createClient(clientForm);
      await loadMasterData();
      setForm((current) => ({ ...current, client: String(created.id), aircraft: "" }));
      setClientForm(emptyClientForm);
      closeDialog();
      await loadAircraftOptions(String(created.id));
    } catch {
      setError("Unable to create client.");
    }
  }

  async function handleCreateAircraft() {
    const selectedClient = form.client || user?.client?.toString();
    if (!selectedClient) {
      setError("Select a client before adding an aircraft.");
      return;
    }

    try {
      const created = await createAircraft({
        client: Number(selectedClient),
        registration_no: aircraftForm.registration_no,
        aircraft_model: aircraftForm.aircraft_model,
        manufacturer: aircraftForm.manufacturer,
      });
      await loadAircraftOptions(selectedClient);
      setForm((current) => ({ ...current, aircraft: String(created.id) }));
      setAircraftForm(emptyAircraftForm);
      closeDialog();
    } catch {
      setError("Unable to create aircraft.");
    }
  }

  async function handleCreateAirport() {
    try {
      const created = await createAirport(airportForm);
      await loadMasterData();
      setForm((current) => ({ ...current, airport: String(created.id) }));
      setAirportForm(emptyAirportForm);
      closeDialog();
    } catch {
      setError("Unable to create airport.");
    }
  }

  async function handleCreateFuelType() {
    try {
      const created = await createFuelType(fuelTypeForm);
      await loadMasterData();
      setForm((current) => ({ ...current, fuel_type: String(created.id) }));
      setFuelTypeForm(emptyFuelTypeForm);
      closeDialog();
    } catch {
      setError("Unable to create fuel type.");
    }
  }

  async function handleCreateFlight() {
    try {
      const created = await createFlightOption(flightForm);
      await loadMasterData();
      setForm((current) => ({ ...current, flight: created.code }));
      setFlightForm(emptyFlightForm);
      closeDialog();
    } catch {
      setError("Unable to create flight option.");
    }
  }

  async function handleCreateRoute() {
    try {
      const created = await createRouteOption(routeForm);
      await loadMasterData();
      setForm((current) => ({ ...current, route: created.name }));
      setRouteForm(emptyRouteForm);
      closeDialog();
    } catch {
      setError("Unable to create route option.");
    }
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Create Order</Typography>
        <Typography color="text.secondary">
          Submit a new fuel request. Managers and customers can add missing dropdown data directly from this form.
        </Typography>
      </div>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}
      {createdOrder && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button variant="outlined" onClick={() => openSendEmailDialog(createdOrder)}>
            Send Email
          </Button>
          <Button variant="outlined" onClick={() => navigate("/orders")}>
            Back to Orders
          </Button>
        </Stack>
      )}
      {user?.role === "CUSTOMER" && !user.client && (
        <Alert severity="info">
          Select a client first to load its aircrafts and create the order.
        </Alert>
      )}

      <Card>
        <CardContent>
          <Stack component="form" spacing={3} onSubmit={handleSubmit}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              <Box>
                <TextField
                  label="Order Date"
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
              </Box>
              <Stack spacing={1}>
                <TextField
                  label="Flight"
                  select
                  value={form.flight}
                  onChange={(event) => setForm((current) => ({ ...current, flight: event.target.value }))}
                  fullWidth
                >
                  {flights.length === 0 && <MenuItem disabled value="">No flights added yet</MenuItem>}
                  {flights.map((flight) => (
                    <MenuItem key={flight.id} value={flight.code}>
                      {flight.code}{flight.description ? ` / ${flight.description}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="text" onClick={() => setDialogKind("flight")} sx={{ alignSelf: "flex-start" }}>
                  Add New Flight
                </Button>
              </Stack>
              <Stack spacing={1}>
                <TextField
                  label="Client"
                  select
                  value={form.client}
                  onChange={(event) => setForm((current) => ({ ...current, client: event.target.value, aircraft: "" }))}
                  disabled={isLinkedCustomer}
                  fullWidth
                >
                  {clients.map((client) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name}
                    </MenuItem>
                  ))}
                </TextField>
                {!isLinkedCustomer && (
                  <Button variant="text" onClick={() => setDialogKind("client")} sx={{ alignSelf: "flex-start" }}>
                    Add New Client
                  </Button>
                )}
              </Stack>
              <Box>
                <TextField
                  label="Flight Status"
                  select
                  value={form.flight_status}
                  onChange={(event) => setForm((current) => ({ ...current, flight_status: event.target.value as FormState["flight_status"] }))}
                  fullWidth
                >
                  <MenuItem value="DOMESTIC">Domestic</MenuItem>
                  <MenuItem value="INTERNATIONAL">International</MenuItem>
                </TextField>
              </Box>
              <Stack spacing={1}>
                <TextField
                  label="Aircraft Reg Number"
                  select
                  value={form.aircraft}
                  onChange={(event) => setForm((current) => ({ ...current, aircraft: event.target.value }))}
                  fullWidth
                >
                  <MenuItem value="">None</MenuItem>
                  {aircrafts.length === 0 && <MenuItem disabled value="">No aircrafts available for selected client</MenuItem>}
                  {aircrafts.map((aircraft) => (
                    <MenuItem key={aircraft.id} value={aircraft.id}>
                      {aircraft.registration_no}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="text" onClick={() => setDialogKind("aircraft")} sx={{ alignSelf: "flex-start" }}>
                  Add New Aircraft
                </Button>
              </Stack>
              <Stack spacing={1}>
                <TextField
                  label="Airport"
                  select
                  value={form.airport}
                  onChange={(event) => setForm((current) => ({ ...current, airport: event.target.value }))}
                  fullWidth
                >
                  {airports.map((airport) => (
                    <MenuItem key={airport.id} value={airport.id}>
                      {airport.code} / {airport.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="text" onClick={() => setDialogKind("airport")} sx={{ alignSelf: "flex-start" }}>
                  Add New Airport
                </Button>
              </Stack>
              <Stack spacing={1}>
                <TextField
                  label="Route"
                  select
                  value={form.route}
                  onChange={(event) => setForm((current) => ({ ...current, route: event.target.value }))}
                  fullWidth
                >
                  {routes.length === 0 && <MenuItem disabled value="">No routes added yet</MenuItem>}
                  {routes.map((route) => (
                    <MenuItem key={route.id} value={route.name}>
                      {route.name}{route.description ? ` / ${route.description}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="text" onClick={() => setDialogKind("route")} sx={{ alignSelf: "flex-start" }}>
                  Add New Route
                </Button>
              </Stack>
              <Stack spacing={1}>
                <TextField
                  label="Fuel Type"
                  select
                  value={form.fuel_type}
                  onChange={(event) => setForm((current) => ({ ...current, fuel_type: event.target.value }))}
                  fullWidth
                >
                  {fuelTypes.map((fuelType) => (
                    <MenuItem key={fuelType.id} value={fuelType.id}>
                      {fuelType.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Button variant="text" onClick={() => setDialogKind("fuelType")} sx={{ alignSelf: "flex-start" }}>
                  Add New Fuel Type
                </Button>
              </Stack>
              <Box>
                <TextField
                  label="Quantity (Liters)"
                  type="number"
                  value={form.quantity_ltrs}
                  onChange={(event) => setForm((current) => ({ ...current, quantity_ltrs: event.target.value }))}
                  inputProps={{ min: 0, step: "0.01" }}
                  fullWidth
                />
              </Box>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate("/orders")}>
                Cancel
              </Button>
              <Button type="submit" variant="contained">
                Submit Order
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Dialog open={dialogKind === "client"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Client</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Client Name" value={clientForm.name} onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Client Code" value={clientForm.code} onChange={(event) => setClientForm((current) => ({ ...current, code: event.target.value }))} fullWidth />
            <TextField label="Contact Email" value={clientForm.contact_email} onChange={(event) => setClientForm((current) => ({ ...current, contact_email: event.target.value }))} fullWidth />
            <TextField label="Contact Phone" value={clientForm.contact_phone} onChange={(event) => setClientForm((current) => ({ ...current, contact_phone: event.target.value }))} fullWidth />
            <TextField label="Address" value={clientForm.address} onChange={(event) => setClientForm((current) => ({ ...current, address: event.target.value }))} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleCreateClient} variant="contained" disabled={!clientForm.name.trim() || !clientForm.code.trim()}>
            Save Client
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogKind === "aircraft"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Aircraft</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Registration Number" value={aircraftForm.registration_no} onChange={(event) => setAircraftForm((current) => ({ ...current, registration_no: event.target.value }))} fullWidth />
            <TextField label="Aircraft Model" value={aircraftForm.aircraft_model} onChange={(event) => setAircraftForm((current) => ({ ...current, aircraft_model: event.target.value }))} fullWidth />
            <TextField label="Manufacturer" value={aircraftForm.manufacturer} onChange={(event) => setAircraftForm((current) => ({ ...current, manufacturer: event.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            onClick={handleCreateAircraft}
            variant="contained"
            disabled={!aircraftForm.registration_no.trim() || !aircraftForm.aircraft_model.trim()}
          >
            Save Aircraft
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogKind === "airport"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Airport</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Airport Code" value={airportForm.code} onChange={(event) => setAirportForm((current) => ({ ...current, code: event.target.value }))} fullWidth />
            <TextField label="Airport Name" value={airportForm.name} onChange={(event) => setAirportForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="City" value={airportForm.city} onChange={(event) => setAirportForm((current) => ({ ...current, city: event.target.value }))} fullWidth />
            <TextField label="Country" value={airportForm.country} onChange={(event) => setAirportForm((current) => ({ ...current, country: event.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleCreateAirport} variant="contained" disabled={!airportForm.code.trim() || !airportForm.name.trim()}>
            Save Airport
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogKind === "fuelType"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Fuel Type</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Fuel Type" value={fuelTypeForm.name} onChange={(event) => setFuelTypeForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Description" value={fuelTypeForm.description} onChange={(event) => setFuelTypeForm((current) => ({ ...current, description: event.target.value }))} fullWidth multiline minRows={2} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleCreateFuelType} variant="contained" disabled={!fuelTypeForm.name.trim()}>
            Save Fuel Type
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogKind === "flight"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Flight</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Flight Code" value={flightForm.code} onChange={(event) => setFlightForm((current) => ({ ...current, code: event.target.value }))} fullWidth />
            <TextField label="Description" value={flightForm.description} onChange={(event) => setFlightForm((current) => ({ ...current, description: event.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleCreateFlight} variant="contained" disabled={!flightForm.code.trim()}>
            Save Flight
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogKind === "route"} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add New Route</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Route Name" value={routeForm.name} onChange={(event) => setRouteForm((current) => ({ ...current, name: event.target.value }))} fullWidth />
            <TextField label="Description" value={routeForm.description} onChange={(event) => setRouteForm((current) => ({ ...current, description: event.target.value }))} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleCreateRoute} variant="contained" disabled={!routeForm.name.trim()}>
            Save Route
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={emailDialogOpen} onClose={() => setEmailDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Send Order Email</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={emailPreview.to_email}
              onChange={(event) => setEmailPreview((current) => ({ ...current, to_email: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Subject"
              value={emailPreview.subject}
              onChange={(event) => setEmailPreview((current) => ({ ...current, subject: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Email Preview"
              value={emailPreview.body}
              onChange={(event) => setEmailPreview((current) => ({ ...current, body: event.target.value }))}
              fullWidth
              multiline
              minRows={10}
            />
            <Alert severity="info">
              PDF attachment: {createdOrder?.ser_no || "Order"}.pdf
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSendEmail} variant="contained" disabled={sendingEmail || !emailPreview.to_email.trim()}>
            {sendingEmail ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
