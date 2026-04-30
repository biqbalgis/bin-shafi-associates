import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
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

import { fetchClients } from "../api/dropdowns";
import { createUser, listUsers, updateUser } from "../api/users";
import type { Client, User, UserRole } from "../types";

const emptyForm = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  password: "",
  password_confirm: "",
  role: "CUSTOMER" as UserRole,
  client: "",
};

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function reloadData() {
    setLoading(true);
    try {
      const [usersData, clientsData] = await Promise.all([listUsers(), fetchClients()]);
      setUsers(usersData);
      setClients(clientsData);
    } catch {
      setMessage({ type: "error", text: "Failed to load user management data." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadData();
  }, []);

  async function handleCreateUser() {
    setMessage(null);
    try {
      await createUser({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        password_confirm: form.password_confirm,
        role: form.role,
        client: form.role === "CUSTOMER" && form.client ? Number(form.client) : null,
        is_active: true,
      });
      setForm(emptyForm);
      setMessage({ type: "success", text: "User created." });
      await reloadData();
    } catch {
      setMessage({ type: "error", text: "User creation failed. Check uniqueness, password, and client selection." });
    }
  }

  async function handleToggleActive(user: User) {
    setMessage(null);
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setMessage({ type: "success", text: `User ${user.is_active ? "deactivated" : "activated"}.` });
      await reloadData();
    } catch {
      setMessage({ type: "error", text: "Failed to update user status." });
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4">User Management</Typography>
        <Typography color="text.secondary">
          Create admin, manager, and customer accounts. Customer users must be linked to a client.
        </Typography>
      </Box>

      {message && <Alert severity={message.type}>{message.text}</Alert>}
      {loading && <Alert severity="info">Refreshing users...</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6">Create User</Typography>
              <Typography variant="body2" color="text.secondary">
                Admins can create all user roles from here.
              </Typography>
            </Box>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
              }}
            >
              <TextField label="Username" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} fullWidth />
              <TextField label="Email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} fullWidth />
              <TextField label="First Name" value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} fullWidth />
              <TextField label="Last Name" value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} fullWidth />
              <TextField
                label="Role"
                select
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                    client: event.target.value === "CUSTOMER" ? current.client : "",
                  }))
                }
                fullWidth
              >
                <MenuItem value="CUSTOMER">Customer</MenuItem>
                <MenuItem value="MANAGER">Manager</MenuItem>
                <MenuItem value="ADMIN">Admin</MenuItem>
              </TextField>
              <TextField
                label="Client"
                select
                value={form.client}
                onChange={(event) => setForm((current) => ({ ...current, client: event.target.value }))}
                disabled={form.role !== "CUSTOMER"}
                fullWidth
              >
                <MenuItem value="">No client</MenuItem>
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} fullWidth />
              <TextField
                label="Confirm Password"
                type="password"
                value={form.password_confirm}
                onChange={(event) => setForm((current) => ({ ...current, password_confirm: event.target.value }))}
                fullWidth
              />
            </Box>
            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={() => void handleCreateUser()}
                disabled={
                  !form.username.trim()
                  || !form.email.trim()
                  || !form.password
                  || !form.password_confirm
                  || (form.role === "CUSTOMER" && !form.client)
                }
              >
                Create User
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">Existing Users</Typography>
              <Typography variant="body2" color="text.secondary">
                Review existing accounts and activate or deactivate them.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => void reloadData()}>
              Refresh
            </Button>
          </Stack>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Username</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary">No users found.</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>{`${user.first_name || ""} ${user.last_name || ""}`.trim() || "--"}</TableCell>
                    <TableCell>{user.email || "--"}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.client_name || "--"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={user.is_active ? "Active" : "Inactive"}
                        color={user.is_active ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="outlined" onClick={() => void handleToggleActive(user)}>
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}
