import { Chip } from "@mui/material";

import type { OrderStatus } from "../types";

const statusMap: Record<OrderStatus, { label: string; color: string; backgroundColor: string }> = {
  PENDING: { label: "Pending", color: "#7a5600", backgroundColor: "#ffe59a" },
  APPROVED: { label: "Approved", color: "#0f4d87", backgroundColor: "#b9dafc" },
  COMPLETED: { label: "Completed", color: "#145f18", backgroundColor: "#bce7c0" },
  CANCELED: { label: "Canceled", color: "#8b1e1e", backgroundColor: "#f6b4b4" },
};

export function OrderStatusChip({ status }: { status: OrderStatus }) {
  const token = statusMap[status];
  return <Chip label={token.label} size="small" sx={{ color: token.color, bgcolor: token.backgroundColor }} />;
}
