import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import SpaceDashboardRoundedIcon from "@mui/icons-material/SpaceDashboardRounded";
import AccountBalanceWalletRoundedIcon from "@mui/icons-material/AccountBalanceWalletRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const drawerWidth = 280;

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = [
    { label: "Dashboard", icon: <SpaceDashboardRoundedIcon />, path: "/" },
    { label: "Orders", icon: <ReceiptLongRoundedIcon />, path: "/orders" },
    ...(user?.role === "ADMIN"
      ? [
          { label: "All Invoices", icon: <ReceiptLongRoundedIcon />, path: "/invoices" },
          { label: "Deposit Sheet", icon: <AccountBalanceWalletRoundedIcon />, path: "/balance-sheet" },
          { label: "Deposit Overview", icon: <InsightsRoundedIcon />, path: "/balance-sheet/overview" },
          { label: "User Management", icon: <GroupRoundedIcon />, path: "/admin/users" },
          { label: "Admin Setup", icon: <SettingsRoundedIcon />, path: "/admin/setup" },
        ]
      : []),
  ];

  const drawer = (
    <Box
      sx={{
        height: "100%",
        background: "linear-gradient(180deg, rgba(16,35,60,0.96), rgba(24,49,83,0.92))",
        color: "#fffaf3",
      }}
    >
      <Stack spacing={1.5} sx={{ p: 3 }}>
        <Typography variant="overline" sx={{ opacity: 0.72, letterSpacing: "0.18em" }}>
          Bin Shafi Aviation
        </Typography>
        <Typography variant="h5">Fuel Operations</Typography>
        <Typography variant="body2" sx={{ opacity: 0.78 }}>
          Aviation orders, approvals, and financial closure in one workflow.
        </Typography>
      </Stack>
      <Divider sx={{ borderColor: "rgba(255,250,243,0.12)" }} />
      <List sx={{ px: 2, py: 2 }}>
        {items.map((item) => (
          <ListItemButton
            key={item.path + item.label}
            component={Link}
            to={item.path}
            selected={location.pathname === item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              mb: 1,
              borderRadius: 3,
              color: "#fffaf3",
              "&.Mui-selected": {
                bgcolor: "rgba(245, 178, 64, 0.2)",
              },
              "&.Mui-selected:hover": {
                bgcolor: "rgba(245, 178, 64, 0.28)",
              },
            }}
          >
            <ListItemIcon sx={{ color: "inherit", minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" sx={{ ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
              <MenuRoundedIcon />
            </IconButton>
            <Box>
              <Typography variant="h6">Fuel Order Control Center</Typography>
              <Typography variant="body2" sx={{ opacity: 0.75 }}>
                {user?.role} workspace
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ bgcolor: "secondary.main", color: "primary.dark" }}>
              {user?.username.slice(0, 1).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="body2">{user?.username}</Typography>
              <Typography variant="caption" sx={{ opacity: 0.74 }}>
                {user?.client_name ?? "Platform access"}
              </Typography>
            </Box>
            <IconButton color="inherit" onClick={logout}>
              <LogoutRoundedIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, border: "none" },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, border: "none" },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, mt: 10 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
