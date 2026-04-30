import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#183153",
      light: "#42658e",
      dark: "#10233c",
      contrastText: "#fffaf3",
    },
    secondary: {
      main: "#d88f14",
      light: "#ebb24d",
      dark: "#a86f0f",
    },
    success: {
      main: "#2e7d32",
    },
    error: {
      main: "#c62828",
    },
    warning: {
      main: "#edb331",
    },
    info: {
      main: "#1976d2",
    },
    background: {
      default: "#f7f3ea",
      paper: "#fffaf3",
    },
  },
  typography: {
    fontFamily: '"Space Grotesk", "Segoe UI", sans-serif',
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 18,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backdropFilter: "blur(14px)",
          backgroundImage: "linear-gradient(135deg, rgba(24,49,83,0.92), rgba(66,101,142,0.88))",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(24,49,83,0.08)",
          boxShadow: "0 18px 40px rgba(24,49,83,0.08)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
});

export default theme;
