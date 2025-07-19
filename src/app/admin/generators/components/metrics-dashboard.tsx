// src/app/admin/generators/components/metrics-dashboard.tsx

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { Activity, TrendingUp, AlertCircle } from "lucide-react";

interface MetricsDashboardProps {
  metrics: {
    summary: Record<
      string,
      {
        total: number;
        previews: number;
        generated: number;
        failed: number;
      }
    >;
    totalGenerations: number;
    successRate: number;
  };
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Total Generations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalGenerations}</div>
          <p className="text-muted-foreground text-xs">Last 30 days</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(metrics.successRate * 100).toFixed(1)}%
          </div>
          <Progress value={metrics.successRate * 100} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">By Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {Object.entries(metrics.summary)
              .slice(0, 3)
              .map(([type, data]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{type}</span>
                  <span className="font-medium">{data.generated}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
