// src/app/admin/generators/components/validation-dialog.tsx
"use client";

import { AlertCircle, AlertTriangle, CheckCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { ScrollArea } from "~/components/ui/scroll-area";

interface ValidationResult {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  suggestions: string[];
}

interface ValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ValidationResult | null;
  onConfirm: () => void;
}

export function ValidationDialog({
  open,
  onOpenChange,
  validation,
  onConfirm
}: ValidationDialogProps) {
  if (!validation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Validation Results
          </DialogTitle>
          <DialogDescription>
            Please review the following issues before proceeding
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {/* Conflicts */}
            {validation.conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Conflicts
                </h4>
                {validation.conflicts.map((conflict, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertDescription>{conflict}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Warnings */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  Warnings
                </h4>
                {validation.warnings.map((warning, index) => (
                  <Alert key={index} className="border-yellow-200 bg-yellow-50">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-800">
                      {warning}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {validation.suggestions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  Suggestions
                </h4>
                {validation.suggestions.map((suggestion, index) => (
                  <Alert key={index} className="border-blue-200 bg-blue-50">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      {suggestion}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {validation.valid ? (
            <Button onClick={onConfirm}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Proceed
            </Button>
          ) : (
            <Button onClick={onConfirm} variant="destructive">
              Force Generate
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}