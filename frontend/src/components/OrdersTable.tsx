import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";
import PaymentsRoundedIcon from "@mui/icons-material/PaymentsRounded";
import {
  Button,
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
import type { Order, OrderStatus } from "../types";
import { OrderStatusChip } from "./OrderStatusChip";

const statusOptions: OrderStatus[] = ["PENDING", "APPROVED", "COMPLETED", "CANCELED"];

export default function OrdersTable({
  orders,
  role,
  onOrderUpdate,
  onSelectOrder,
}: {
  orders: Order[];
  role: string;
  onOrderUpdate?: (orderId: number, payload: { status?: OrderStatus; dr_no?: string }) => void;
  onSelectOrder?: (order: Order) => void;
}) {
  const [drNoDrafts, setDrNoDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setDrNoDrafts(
      Object.fromEntries(orders.map((order) => [order.id, order.dr_no ?? ""]))
    );
  }, [orders]);

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Serial</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Flight</TableCell>
            <TableCell>Client</TableCell>
            <TableCell>Aircraft</TableCell>
            <TableCell>Airport</TableCell>
            <TableCell>Quantity</TableCell>
            <TableCell>DR No</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={10}>
                <Typography color="text.secondary">No orders found for the selected view.</Typography>
              </TableCell>
            </TableRow>
          )}
          {orders.map((order) => (
            <TableRow key={order.id} hover>
              <TableCell>
                <Typography fontWeight={700}>{order.ser_no}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {order.route}
                </Typography>
              </TableCell>
              <TableCell>{new Date(order.date).toLocaleDateString()}</TableCell>
              <TableCell>
                <Typography fontWeight={600}>{order.flight}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {order.flight_status === "DOMESTIC" ? "Domestic" : "International"}
                </Typography>
              </TableCell>
              <TableCell>{order.client_name}</TableCell>
              <TableCell>{order.aircraft_registration}</TableCell>
              <TableCell>{order.airport_name}</TableCell>
              <TableCell>{Number(order.quantity_ltrs).toLocaleString()} L</TableCell>
              <TableCell>
                {role === "CUSTOMER" ? (
                  order.dr_no || "--"
                ) : (
                  <TextField
                    size="small"
                    value={drNoDrafts[order.id] ?? ""}
                    placeholder="Add DR No"
                    sx={{ minWidth: 148 }}
                    onChange={(event) =>
                      setDrNoDrafts((current) => ({
                        ...current,
                        [order.id]: event.target.value,
                      }))
                    }
                    onBlur={() => {
                      const nextDrNo = (drNoDrafts[order.id] ?? "").trim();
                      if (nextDrNo !== order.dr_no) {
                        onOrderUpdate?.(order.id, { dr_no: nextDrNo });
                      }
                    }}
                  />
                )}
              </TableCell>
              <TableCell>
                {role === "CUSTOMER" ? (
                  <OrderStatusChip status={order.status} />
                ) : (
                  <TextField
                    size="small"
                    select
                    value={order.status}
                    onChange={(event) =>
                      onOrderUpdate?.(order.id, {
                        status: event.target.value as OrderStatus,
                        dr_no: (drNoDrafts[order.id] ?? "").trim(),
                      })
                    }
                    sx={{ minWidth: 148 }}
                  >
                    {(role === "MANAGER" && order.status === "COMPLETED"
                      ? statusOptions
                      : role === "MANAGER"
                        ? statusOptions.filter((status) => status !== "COMPLETED")
                        : statusOptions
                    ).map((status) => (
                      <MenuItem
                        key={status}
                        value={status}
                        disabled={
                          (role === "MANAGER" && status === "COMPLETED")
                          || (role !== "MANAGER" && status === "COMPLETED" && !(drNoDrafts[order.id] ?? "").trim())
                        }
                      >
                        {status}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<OpenInNewRoundedIcon />}
                    onClick={() => onSelectOrder?.(order)}
                  >
                    History
                  </Button>
                  {role === "ADMIN" && (
                    <Button
                      component={Link}
                      to={`/financials/${order.id}`}
                      size="small"
                      variant="contained"
                      startIcon={<PaymentsRoundedIcon />}
                    >
                      Financials
                    </Button>
                  )}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
