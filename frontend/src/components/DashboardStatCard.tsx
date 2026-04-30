import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { Card, CardContent, Stack, Typography } from "@mui/material";

export function DashboardStatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <Card sx={{ height: "100%", background: `linear-gradient(160deg, ${accent}20, rgba(255,250,243,0.92))` }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <div>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h4" sx={{ mt: 1 }}>
              {value}
            </Typography>
          </div>
          <TrendingUpRoundedIcon sx={{ color: accent }} />
        </Stack>
      </CardContent>
    </Card>
  );
}
