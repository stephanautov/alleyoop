// src/app/admin/generators/components/bulk-generate-dialog.tsx

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

interface BulkOperation {
    type: "router" | "component" | "test";
    name: string;
    options: Record<string, any>;
}

interface BulkGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGenerate: (operations: BulkOperation[]) => void;
}

export function BulkGenerateDialog({ open, onOpenChange, onGenerate }: BulkGenerateDialogProps) {
    const [operations, setOperations] = useState<BulkOperation[]>([
        { type: "router", name: "", options: {} }
    ]);

    const addOperation = () => {
        setOperations([...operations, { type: "router", name: "", options: {} }]);
    };

    const removeOperation = (index: number) => {
        setOperations(operations.filter((_, i) => i !== index));
    };

    const updateOperation = (index: number, updates: Partial<BulkOperation>) => {
        const newOps = [...operations];
        newOps[index] = { ...newOps[index], ...updates };
        setOperations(newOps);
    };

    const handleGenerate = () => {
        const validOps = operations.filter(op => op.name);
        if (validOps.length > 0) {
            onGenerate(validOps);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk Generate</DialogTitle>
                    <DialogDescription>
                        Generate multiple items at once (max 10)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 my-4 max-h-96 overflow-y-auto">
                    {operations.map((op, index) => (
                        <div key={index} className="flex gap-2 items-end">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                        value={op.type}
                                        onValueChange={(value: any) => updateOperation(index, { type: value })}
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
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={op.name}
                                        onChange={(e) => updateOperation(index, { name: e.target.value })}
                                        placeholder={`Enter ${op.type} name`}
                                    />
                                </div>
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

                <Button
                    variant="outline"
                    onClick={addOperation}
                    disabled={operations.length >= 10}
                    className="w-full"
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Operation
                </Button>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate}>
                        Generate {operations.filter(op => op.name).length} Items
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}