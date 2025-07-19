// src/app/admin/generators/components/rate-limit-indicator.tsx

import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Clock } from "lucide-react";

interface RateLimitIndicatorProps {
  limit: number;
  remaining: number;
  reset?: number;
}

export function RateLimitIndicator({
  limit,
  remaining,
  reset,
}: RateLimitIndicatorProps) {
  const used = limit - remaining;
  const percentage = (used / limit) * 100;

  const variant =
    percentage > 80 ? "destructive" : percentage > 50 ? "secondary" : "default";

  return (
    <div className="flex items-center gap-2">
      <Badge variant={variant} className="gap-1">
        <Clock className="h-3 w-3" />
        {remaining}/{limit} remaining
      </Badge>
      <Progress value={percentage} className="h-2 w-24" />
      {reset && remaining === 0 && (
        <span className="text-muted-foreground text-xs">
          Resets in {Math.ceil((reset - Date.now()) / 1000)}s
        </span>
      )}
    </div>
  );
}
