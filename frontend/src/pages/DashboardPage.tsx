import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import {
  Alert,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";

import { listOrders } from "../api/orders";
import { DashboardStatCard } from "../components/DashboardStatCard";
import { OrderStatusChip } from "../components/OrderStatusChip";
import { useAuth } from "../context/AuthContext";
import type { Order } from "../types";

export default function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listOrders({ scope: "all" })
      .then(setOrders)
      .catch(() => setError("Unable to load dashboard metrics."));
  }, []);

  const pendingCount = orders.filter((order) => order.status === "PENDING").length;
  const approvedCount = orders.filter((order) => order.status === "APPROVED").length;
  const completedCount = orders.filter((order) => order.status === "COMPLETED").length;

  return (
    <Stack spacing={3}>
      <Card sx={{ background: "linear-gradient(140deg, rgba(24,49,83,0.96), rgba(66,101,142,0.88))", color: "white" }}>
        <CardContent sx={{ py: 4 }}>
          <Typography variant="overline" sx={{ opacity: 0.72, letterSpacing: "0.16em" }}>
            Daily Ops Snapshot
          </Typography>
          <Typography variant="h3" sx={{ mt: 1, maxWidth: 680 }}>
            Track aviation fuel demand, approvals, and profit closure without losing the order trail.
          </Typography>
          <Typography sx={{ mt: 1.5, opacity: 0.78 }}>
            Signed in as {user?.username} {user?.client_name ? `for ${user.client_name}` : ""}.
          </Typography>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
        }}
      >
        <Box>
          <DashboardStatCard label="Total Orders" value={orders.length} accent="#183153" />
        </Box>
        <Box>
          <DashboardStatCard label="Pending" value={pendingCount} accent="#d88f14" />
        </Box>
        <Box>
          <DashboardStatCard label="Approved" value={approvedCount} accent="#1976d2" />
        </Box>
        <Box>
          <DashboardStatCard label="Completed" value={completedCount} accent="#2e7d32" />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.4fr) minmax(0, 1fr)" },
        }}
      >
        <Box>
          <Card>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                <ReceiptLongRoundedIcon color="primary" />
                <Typography variant="h6">Recent Orders</Typography>
              </Stack>
              <List disablePadding>
                {orders.slice(0, 5).map((order) => (
                  <ListItem key={order.id} disableGutters divider>
                    <ListItemText
                      primary={`${order.ser_no} / ${order.flight}`}
                      secondary={`${order.client_name} / ${order.aircraft_registration} / ${new Date(order.date).toLocaleDateString()}`}
                    />
                    <OrderStatusChip status={order.status} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
        <Box>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Workflow Health
              </Typography>
              <Stack spacing={2}>
                <Typography color="text.secondary">
                  Pending approvals: {pendingCount}. Approved waiting on financial closure: {approvedCount}.
                </Typography>
                <Typography color="text.secondary">
                  Completed orders: {completedCount}. Managers can update statuses, while admins finish DR and financial details.
                </Typography>
                <Typography color="text.secondary">
                  Financial access is restricted to admins and stays hidden from customer and manager order views.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Stack>
  );
}
