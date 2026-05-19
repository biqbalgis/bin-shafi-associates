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
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { fetchCompanyProfile } from "../api/companyProfile";
import { useAuth } from "../context/AuthContext";
import type { CompanyProfile } from "../types";

const HERO_AIRCRAFT_IMAGE =
  "/bg.png";
const COMPANY_LOGO_PATH = "/binshafi-logo.png";
const DEFAULT_COMPANY_NAME = "Bin Shafi Fuel";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCompanyProfile()
      .then((payload) => setCompanyProfile(payload))
      .catch(() => setCompanyProfile(null));
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const companyName = companyProfile?.company_name || DEFAULT_COMPANY_NAME;
  const companyAddress = companyProfile?.address || "Address not configured";
  const companyPhone = companyProfile?.phone || "Phone not configured";
  const companyEmail = companyProfile?.email || "Email not configured";

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
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 2 },
        background:
          `linear-gradient(180deg, rgba(248,244,235,0.5) 0%, rgba(239,229,210,0.5) 100%), url(${HERO_AIRCRAFT_IMAGE})`,
        backgroundSize: "cover",
        // backgroundPosition: "center center",
        // backgroundAttachment: { md: "fixed" },
      }}
    >
      <Typography
        sx={{
          position: "fixed",
          top: { xs: 18, md: 26 },
          left: { xs: 18, md: 28 },
          zIndex: 1,
          fontSize: { xs: "1.35rem", sm: "1.7rem", md: "2rem" },
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: "#ffffff",
          textShadow: "0 8px 24px rgba(11,20,33,0.45)",
        }}
      >
        {companyName}
      </Typography>

      <Box
        sx={{
          width: "100%",
          maxWidth: 1440,
          mx: "auto",
          minHeight: { md: "calc(100vh - 350px)" },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1.55fr) minmax(380px, 440px)" },
          gap: { xs: 3, md: 4 },
          alignItems: "center",
        }}
      >
        <Stack
          spacing={3}
          sx={{
            alignItems: { xs: "center", md: "flex-start" },
            textAlign: { xs: "center", md: "left" },
            px: { md: 0 },
            width: "80%",
          }}
        >
          <Box
            sx={{
              position: "relative",
              width: "80%",
              // maxWidth: { xs: 620, md: "100%" },
              // minHeight: { xs: 100, sm: 140, md: 10 },
              borderRadius: { xs: 5, md: 7 },
              bgcolor: "rgba(255,255,255,0.28)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 24px 60px rgba(24,49,83,0.1)",
              "&::after": {
                content: '""',
                position: "absolute",
                inset: 18,
                borderRadius: { xs: 4, md: 6 },
                border: "1px solid rgba(255,255,255,0.28)",
                zIndex: 2,
              },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.5), transparent 100%), linear-gradient(135deg, rgba(24,49,83,0.08), rgba(216,143,20,0.12))",
              }}
            />
          </Box>

          {/* <Stack spacing={1} sx={{ alignItems: { xs: "center", md: "flex-start" } }}>
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
          </Stack> */}
        </Stack>

        <Card sx={{ width: "100%", maxWidth: 440, justifySelf: "center" }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  component="img"
                  src={COMPANY_LOGO_PATH}
                  alt="Bin Shafi logo"
                  sx={{
                    width: 58,
                    height: 58,
                    objectFit: "contain",
                    borderRadius: 2,
                    p: 0.75,
                    bgcolor: "rgba(255,255,255,0.88)",
                    border: "1px solid rgba(24,49,83,0.1)",
                  }}
                />
                <Typography variant="overline" color="secondary.main">
                  Secure Access
                </Typography>
              </Stack>

              <Box>
                <Typography variant="h4">Portal Login</Typography>
              </Box>

              <Divider />

              <Typography color="text.secondary">
                Sign in with your assigned credentials to manage fuel requests and financial closure.
              </Typography>

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{companyName}</Typography>
                <Typography color="text.secondary">{companyAddress}</Typography>
                <Typography color="text.secondary">Phone: {companyPhone}</Typography>
                <Typography color="text.secondary">Email: {companyEmail}</Typography>
              </Stack>

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
