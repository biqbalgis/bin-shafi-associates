import FlightTakeoffRoundedIcon from "@mui/icons-material/FlightTakeoffRounded";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/", { replace: true });
    } catch {
      setError("Login failed. Check your username and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 5 },
        background:
          "radial-gradient(circle at top left, rgba(216,143,20,0.22), transparent 28%), radial-gradient(circle at bottom right, rgba(24,49,83,0.16), transparent 32%), linear-gradient(180deg, #f8f4eb 0%, #efe5d2 100%)",
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1180,
          mx: "auto",
          minHeight: { md: "calc(100vh - 40px)" },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.2fr) minmax(360px, 440px)" },
          gap: { xs: 3, md: 6 },
          alignItems: "center",
        }}
      >
        <Stack
          spacing={3}
          sx={{
            alignItems: { xs: "center", md: "flex-start" },
            textAlign: { xs: "center", md: "left" },
            px: { md: 2 },
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: { xs: 260, sm: 320, md: 380 },
              height: { xs: 260, sm: 320, md: 380 },
              display: "grid",
              placeItems: "center",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.96), rgba(255,250,243,0.72) 35%, rgba(24,49,83,0.1) 100%)",
              border: "1px solid rgba(24,49,83,0.1)",
              boxShadow:
                "0 30px 80px rgba(24,49,83,0.16), inset 0 -20px 60px rgba(216,143,20,0.12)",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 24,
                borderRadius: "50%",
                border: "1px dashed rgba(24,49,83,0.14)",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                width: "72%",
                height: 26,
                bottom: 54,
                borderRadius: 999,
                background: "linear-gradient(90deg, rgba(24,49,83,0), rgba(24,49,83,0.14), rgba(24,49,83,0))",
                filter: "blur(10px)",
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: "68%",
                height: "68%",
                borderRadius: "50%",
                background:
                  "conic-gradient(from 180deg, rgba(216,143,20,0.16), rgba(24,49,83,0.08), rgba(216,143,20,0.16))",
                filter: "blur(10px)",
              }}
            />
            <FlightTakeoffRoundedIcon
              sx={{
                fontSize: { xs: 132, sm: 160, md: 192 },
                color: "primary.main",
                transform: "rotate(-10deg) translateY(-10px)",
                zIndex: 1,
                filter: "drop-shadow(0 12px 20px rgba(24,49,83,0.22))",
              }}
            />
          </Box>

          <Stack spacing={1} sx={{ alignItems: { xs: "center", md: "flex-start" } }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "2.5rem", sm: "3.4rem", md: "4.5rem" },
                lineHeight: 0.95,
                letterSpacing: "-0.06em",
                textTransform: "lowercase",
              }}
            >
              binshafi fuel
            </Typography>
            <Typography
              sx={{
                maxWidth: 560,
                color: "text.secondary",
                fontSize: { xs: "1rem", md: "1.1rem" },
              }}
            >
              Aviation fuel operations, order tracking, and financial closure in one workspace.
            </Typography>
          </Stack>
        </Stack>

        <Card sx={{ width: "100%", maxWidth: 440, justifySelf: "center" }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="secondary.main">
                  Secure Access
                </Typography>
                <Typography variant="h4">Portal Login</Typography>
              </Box>

              <Divider />

              <Typography color="text.secondary">
                Sign in with your assigned credentials to manage fuel requests and financial closure.
              </Typography>

              {error && <Alert severity="error">{error}</Alert>}

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <TextField
                    label="Username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    type="password"
                    label="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    fullWidth
                  />
                  <Button type="submit" size="large" variant="contained" disabled={submitting}>
                    {submitting ? <CircularProgress size={22} color="inherit" /> : "Login"}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
