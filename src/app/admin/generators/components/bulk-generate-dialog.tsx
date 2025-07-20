// src/app/admin/generators/components/bulk-generate-dialog.tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { api } from "~/trpc/react";

interface BulkOperation {
  type: string;
  name: string;
  options: Record<string, any>;
}

export function BulkGenerateDialog() {
  const [open, setOpen] = useState(false);
  const [operations, setOperations] = useState<BulkOperation[]>([
    { type: "router", name: "", options: {} }
  ]);

  const bulkGenerateMutation = api.generators.bulkGenerate.useMutation({
    onSuccess: (data: any) => {
      const successful = data.results.filter((r: any) => r.success).length;
      const failed = data.results.filter((r: any) => !r.success).length;

      toast.success(`Bulk generation complete: ${successful} succeeded, ${failed} failed`);
      setOpen(false);
      setOperations([{ type: "router", name: "", options: {} } as BulkOperation]);
    },
    onError: (error: any) => {
      toast.error(error.message);
    }
  });

  const addOperation = () => {
    setOperations([...operations, { type: "router", name: "", options: {} } as BulkOperation]);
  };

  const removeOperation = (index: number) => {
    setOperations(operations.filter((_, i: number) => i !== index));
  };

  const updateOperation = (index: number, updates: Partial<BulkOperation>) => {
    const newOps = [...operations];
    newOps[index] = { ...newOps[index], ...updates };
    setOperations(newOps);
  };

  const handleGenerate = () => {
    const validOps = operations.filter((op: BulkOperation) => op.name);
    if (validOps.length === 0) {
      toast.error("Please add at least one valid operation");
      return;
    }

    bulkGenerateMutation.mutate({ operations: validOps });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Package className="h-4 w-4 mr-2" />
          Bulk Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Code Generation</DialogTitle>
          <DialogDescription>
            Generate multiple files at once. Add up to 10 operations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {operations.map((op, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1">
                <Label>Type</Label>
                <Select
                  value={op.type}
                  onValueChange={(value) => updateOperation(index, { type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="router">Router</SelectItem>
                    <SelectItem value="component">Component</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label>Name</Label>
                <Input
                  value={op.name}
                  onChange={(e) => updateOperation(index, { name: e.target.value })}
                  placeholder="Enter name"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeOperation(index)}
                disabled={operations.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={addOperation}
            disabled={operations.length >= 10}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Operation
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={bulkGenerateMutation.isPending}
          >
            Generate All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}