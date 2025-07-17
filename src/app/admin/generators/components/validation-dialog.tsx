// src/app/admin/generators/components/validation-dialog.tsx

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { AlertCircle, AlertTriangle, Lightbulb } from "lucide-react";

interface ValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: {
    valid: boolean;
    conflicts: string[];
    warnings: string[];
    suggestions: string[];
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export function ValidationDialog({
  open,
  onOpenChange,
  validation,
  onConfirm,
  onCancel,
}: ValidationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generation Validation</DialogTitle>
          <DialogDescription>
            Review the following items before proceeding
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 space-y-4">
          {validation.conflicts.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Conflicts Found</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 ml-4 list-disc">
                  {validation.conflicts.map((conflict, i) => (
                    <li key={i}>{conflict}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 ml-4 list-disc">
                  {validation.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {validation.suggestions.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-900">Suggestions</AlertTitle>
              <AlertDescription className="text-blue-800">
                <ul className="mt-2 ml-4 list-disc">
                  {validation.suggestions.map((suggestion, i) => (
                    <li key={i}>{suggestion}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant={
              validation.conflicts.length > 0 ? "destructive" : "default"
            }
          >
            {validation.conflicts.length > 0 ? "Force Generate" : "Continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
