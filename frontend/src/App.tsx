import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute, RoleRoute } from "./components/ProtectedRoute";
import AppShell from "./layouts/AppShell";
import AdminSetupPage from "./pages/AdminSetupPage";
import BalanceSheetOverviewPage from "./pages/BalanceSheetOverviewPage";
import BalanceSheetPage from "./pages/BalanceSheetPage";
import CreateOrderPage from "./pages/CreateOrderPage";
import DashboardPage from "./pages/DashboardPage";
import FinancialPage from "./pages/FinancialPage";
import LoginPage from "./pages/LoginPage";
import OrdersPage from "./pages/OrdersPage";
import UserManagementPage from "./pages/UserManagementPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route
          path="orders/new"
          element={
            <RoleRoute allowedRoles={["CUSTOMER", "MANAGER", "ADMIN"]}>
              <CreateOrderPage />
            </RoleRoute>
          }
        />
        <Route
          path="balance-sheet"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <BalanceSheetPage />
            </RoleRoute>
          }
        />
        <Route
          path="balance-sheet/:orderId"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <BalanceSheetPage />
            </RoleRoute>
          }
        />
        <Route
          path="balance-sheet/overview"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <BalanceSheetOverviewPage />
            </RoleRoute>
          }
        />
        <Route
          path="financials/:orderId"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <FinancialPage />
            </RoleRoute>
          }
        />
        <Route
          path="admin/setup"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <AdminSetupPage />
            </RoleRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <UserManagementPage />
            </RoleRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
