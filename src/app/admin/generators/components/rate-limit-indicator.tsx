// src/app/admin/generators/components/rate-limit-indicator.tsx
"use client";

import { useEffect, useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Clock, Zap } from "lucide-react";
import { api } from "~/trpc/react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export function RateLimitIndicator() {
  const { data: rateLimit } = api.generators.getRateLimit.useQuery(undefined, {
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  if (!rateLimit) return null;

  const rl = rateLimit as any;

  const percentage = (rl.remaining / rl.limit) * 100;
  const resetIn = new Date(rl.reset).getTime() - Date.now();
  const resetMinutes = Math.ceil(resetIn / 60000);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge variant={percentage < 20 ? "destructive" : "secondary"}>
              <Zap className="h-3 w-3 mr-1" />
              {rl.remaining}/{rl.limit}
            </Badge>
            <Progress value={percentage} className="w-20 h-2" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p>Rate Limit: {rl.remaining} remaining</p>
            <p className="text-muted-foreground">
              Resets in {resetMinutes} minutes
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}