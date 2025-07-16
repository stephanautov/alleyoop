//src/components/forms/form-generator.tsx

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Calendar } from "~/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { format } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { useState } from "react";

// Types for form generation
export interface FormGeneratorProps<T extends z.ZodType<any, any>> {
    schema: T;
    onSubmit: (data: z.infer<T>) => void | Promise<void>;
    defaultValues?: Partial<z.infer<T>>;
    isSubmitting?: boolean;
    submitText?: string;
    cancelText?: string;
    onCancel?: () => void;
    fieldConfig?: FieldConfig<z.infer<T>>;
    className?: string;
}

// Options applicable to a single form field
export type FieldOptions = {
    label?: string;
    placeholder?: string;
    description?: string;
    type?: string;
    hidden?: boolean;
    disabled?: boolean;
    options?: { label: string; value: string }[];
    rows?: number; // for textarea
    multiple?: boolean; // for array fields
};

// Configuration object mapping each schema key to its options
export type FieldConfig<T> = Partial<Record<keyof T, FieldOptions>>;

// Type guards for Zod types
function isZodString(schema: z.ZodTypeAny): schema is z.ZodString {
    return schema._def.typeName === "ZodString";
}

function isZodNumber(schema: z.ZodTypeAny): schema is z.ZodNumber {
    return schema._def.typeName === "ZodNumber";
}

function isZodBoolean(schema: z.ZodTypeAny): schema is z.ZodBoolean {
    return schema._def.typeName === "ZodBoolean";
}

function isZodEnum(schema: z.ZodTypeAny): schema is z.ZodEnum<any> {
    return schema._def.typeName === "ZodEnum";
}

function isZodArray(schema: z.ZodTypeAny): schema is z.ZodArray<any> {
    return schema._def.typeName === "ZodArray";
}

function isZodObject(schema: z.ZodTypeAny): schema is z.ZodObject<any> {
    return schema._def.typeName === "ZodObject";
}

function isZodDate(schema: z.ZodTypeAny): schema is z.ZodDate {
    return schema._def.typeName === "ZodDate";
}

function isZodOptional(schema: z.ZodTypeAny): schema is z.ZodOptional<any> {
    return schema._def.typeName === "ZodOptional";
}

// Extract the inner type from optional schemas
function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
    if (isZodOptional(schema)) {
        return schema._def.innerType;
    }
    return schema;
}

// Convert field name to human-readable label
function humanizeFieldName(fieldName: string): string {
    return fieldName
        .replace(/([A-Z])/g, " $1")
        .replace(/_/g, " ")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
}

// Generic field renderer
function renderField<T extends Record<string, any>>(
    fieldName: keyof T,
    fieldSchema: z.ZodTypeAny,
    form: any,
    config?: FieldOptions
) {
    const unwrappedSchema = unwrapOptional(fieldSchema);
    const isOptional = isZodOptional(fieldSchema);

    // Handle hidden fields
    if (config?.hidden) {
        return null;
    }

    // String fields
    if (isZodString(unwrappedSchema)) {
        const isLongText = config?.type === "textarea" || config?.rows;

        return (
            <FormField
                control={form.control}
                name={fieldName as string}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {config?.label || humanizeFieldName(fieldName as string)}
                            {!isOptional && <span className="text-red-500 ml-1">*</span>}
                        </FormLabel>
                        {config?.description && (
                            <FormDescription>{config.description}</FormDescription>
                        )}
                        <FormControl>
                            {isLongText ? (
                                <Textarea
                                    {...field}
                                    value={field.value ?? ""}
                                    placeholder={config?.placeholder}
                                    disabled={config?.disabled}
                                    rows={config?.rows || 4}
                                />
                            ) : (
                                <Input
                                    {...field}
                                    value={field.value ?? ""}
                                    type={config?.type ?? "text"}
                                    placeholder={config?.placeholder}
                                    disabled={config?.disabled}
                                />
                            )}
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    // Number fields
    if (isZodNumber(unwrappedSchema)) {
        return (
            <FormField
                control={form.control}
                name={fieldName as string}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {config?.label || humanizeFieldName(fieldName as string)}
                            {!isOptional && <span className="text-red-500 ml-1">*</span>}
                        </FormLabel>
                        {config?.description && (
                            <FormDescription>{config.description}</FormDescription>
                        )}
                        <FormControl>
                            <Input
                                {...field}
                                value={field.value ?? ""}
                                type="number"
                                placeholder={config?.placeholder}
                                disabled={config?.disabled}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    // Boolean fields
    if (isZodBoolean(unwrappedSchema)) {
        return (
            <FormField
                control={form.control}
                name={fieldName as string}
                render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base">
                                {config?.label || humanizeFieldName(fieldName as string)}
                            </FormLabel>
                            {config?.description && (
                                <FormDescription>{config.description}</FormDescription>
                            )}
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={config?.disabled}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        );
    }

    // Enum fields
    if (isZodEnum(unwrappedSchema)) {
        const options = config?.options || unwrappedSchema._def.values.map((value: string) => ({
            label: humanizeFieldName(value),
            value,
        }));

        return (
            <FormField
                control={form.control}
                name={fieldName as string}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            {config?.label || humanizeFieldName(fieldName as string)}
                            {!isOptional && <span className="text-red-500 ml-1">*</span>}
                        </FormLabel>
                        {config?.description && (
                            <FormDescription>{config.description}</FormDescription>
                        )}
                        <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            disabled={config?.disabled}
                        >
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={config?.placeholder ?? "Select an option"} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {options.map((option: { label: string; value: string }) => {
                                    const opt = option;
                                    return (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    // Array fields
    if (isZodArray(unwrappedSchema)) {
        return <ArrayField fieldName={fieldName as string} form={form} config={config} />;
    }

    // Date fields
    if (isZodDate(unwrappedSchema)) {
        return (
            <FormField
                control={form.control}
                name={fieldName as string}
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>
                            {config?.label || humanizeFieldName(fieldName as string)}
                            {!isOptional && <span className="text-red-500 ml-1">*</span>}
                        </FormLabel>
                        {config?.description && (
                            <FormDescription>{config.description}</FormDescription>
                        )}
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        disabled={config?.disabled}
                                    >
                                        {field.value ? (
                                            format(field.value, "PPP")
                                        ) : (
                                            <span>{config?.placeholder ?? "Pick a date"}</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                        date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    // Nested object fields
    if (isZodObject(unwrappedSchema)) {
        return (
            <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium">
                    {config?.label || humanizeFieldName(fieldName as string)}
                </h4>
                {Object.entries(unwrappedSchema.shape).map(([nestedFieldName, nestedSchema]) => (
                    <div key={nestedFieldName}>
                        {renderField(
                            `${fieldName as string}.${nestedFieldName}` as keyof T,
                            nestedSchema as z.ZodTypeAny,
                            form,
                            config
                        )}
                    </div>
                ))}
            </div>
        );
    }

    // Default: render as text input
    return (
        <FormField
            control={form.control}
            name={fieldName as string}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>
                        {config?.label || humanizeFieldName(fieldName as string)}
                        {!isOptional && <span className="text-red-500 ml-1">*</span>}
                    </FormLabel>
                    <FormControl>
                        <Input {...field} value={field.value ?? ""} disabled={config?.disabled} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

// Array field component
function ArrayField<T>({
    fieldName,
    form,
    config,
}: {
    fieldName: string;
    form: any;
    config?: any;
}) {
    const [inputValue, setInputValue] = useState("");
    const fieldValue = form.watch(fieldName) || [];

    const handleAdd = () => {
        if (inputValue.trim()) {
            form.setValue(fieldName, [...fieldValue, inputValue.trim()]);
            setInputValue("");
        }
    };

    const handleRemove = (index: number) => {
        form.setValue(
            fieldName,
            fieldValue.filter((_: any, i: number) => i !== index)
        );
    };

    return (
        <FormItem>
            <FormLabel>
                {config?.label || humanizeFieldName(fieldName)}
            </FormLabel>
            {config?.description && (
                <FormDescription>{config.description}</FormDescription>
            )}
            <div className="space-y-2">
                <div className="flex gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={config?.placeholder ?? "Add item"}
                        onKeyPress={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleAdd();
                            }
                        }}
                    />
                    <Button type="button" onClick={handleAdd} size="sm">
                        Add
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {fieldValue.map((item: string, index: number) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer"
                            onClick={() => handleRemove(index)}
                        >
                            {item} ×
                        </Badge>
                    ))}
                </div>
            </div>
            <FormMessage />
        </FormItem>
    );
}

// Main form generator component
export function FormGenerator<T extends z.ZodType<any, any>>({
    schema,
    onSubmit,
    defaultValues,
    isSubmitting = false,
    submitText = "Submit",
    cancelText = "Cancel",
    onCancel,
    fieldConfig = {},
    className,
}: FormGeneratorProps<T>) {
    const form = useForm<z.infer<T>>({
        resolver: zodResolver(schema),
        defaultValues: defaultValues as any,
    });

    const handleSubmit = async (data: z.infer<T>) => {
        try {
            await onSubmit(data);
        } catch (error) {
            console.error("Form submission error:", error);
        }
    };

    // Extract fields from schema
    const fields = schema instanceof z.ZodObject ? schema.shape : {};

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className={cn("space-y-6", className)}
            >
                {Object.entries(fields).map(([fieldName, fieldSchema]) => (
                    <div key={fieldName}>
                        {renderField(
                            fieldName as keyof z.infer<T>,
                            fieldSchema as z.ZodTypeAny,
                            form,
                            (fieldConfig as Record<string, FieldOptions | undefined>)[fieldName] // cast for generic safety
                        )}
                    </div>
                ))}

                <div className="flex gap-4">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {submitText}
                    </Button>
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel}>
                            {cancelText}
                        </Button>
                    )}
                </div>
            </form>
        </Form>
    );
}

// Export a hook for creating forms programmatically
export function useGeneratedForm<T extends z.ZodType<any, any>>(
    schema: T,
    config?: {
        fieldConfig?: FieldConfig<z.infer<T>>;
        defaultValues?: Partial<z.infer<T>>;
    }
) {
    const form = useForm<z.infer<T>>({
        resolver: zodResolver(schema),
        defaultValues: config?.defaultValues as any,
    });

    return {
        form,
        FormComponent: (props: Omit<FormGeneratorProps<T>, "schema">) => (
            <FormGenerator
                schema={schema}
                {...props}
                fieldConfig={
                    {
                        ...(config?.fieldConfig ?? {}),
                        ...(props.fieldConfig ?? {}),
                    } as unknown as FieldConfig<z.infer<T>>
                }
                defaultValues={{
                    ...(config?.defaultValues ?? {}),
                    ...(props.defaultValues ?? {}),
                } as Partial<z.infer<T>>}
            />
        ),
    };
}