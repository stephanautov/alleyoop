// src/components/forms/form-generator.tsx
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Loader2 } from "lucide-react";
import { cn } from "~/lib/utils";
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

export type FieldOptions = {
  label?: string;
  placeholder?: string;
  description?: string;
  type?: string;
  hidden?: boolean;
  disabled?: boolean;
  options?: { label: string; value: string }[];
  rows?: number;
  multiple?: boolean;
};

export type FieldConfig<T> = {
  [K in keyof T]?: FieldOptions;
};

// Convert field name to human-readable label
function humanizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// Get default value based on Zod type
function getDefaultValue(schema: z.ZodTypeAny): any {
  if (schema instanceof z.ZodString) return "";
  if (schema instanceof z.ZodNumber) return 0;
  if (schema instanceof z.ZodBoolean) return false;
  if (schema instanceof z.ZodArray) return [];
  if (schema instanceof z.ZodEnum) {
    const values = schema._def.values;
    return values[0] || "";
  }
  if (schema instanceof z.ZodOptional) {
    return getDefaultValue(schema._def.innerType);
  }
  if (schema instanceof z.ZodDefault) {
    return schema._def.defaultValue();
  }
  if (schema instanceof z.ZodObject) {
    const shape = schema._def.shape();
    const obj: any = {};
    for (const [key, value] of Object.entries(shape)) {
      obj[key] = getDefaultValue(value as z.ZodTypeAny);
    }
    return obj;
  }
  return "";
}

// Array field component with controlled inputs
function ArrayField({
  fieldName,
  form,
  config,
}: {
  fieldName: string;
  form: any;
  config?: FieldOptions;
}) {
  const [inputValue, setInputValue] = useState("");
  const fieldValue = form.watch(fieldName) || [];

  const handleAdd = () => {
    if (inputValue.trim()) {
      const currentValues = form.getValues(fieldName) || [];
      form.setValue(fieldName, [...currentValues, inputValue.trim()], {
        shouldValidate: true,
        shouldDirty: true,
      });
      setInputValue("");
    }
  };

  const handleRemove = (index: number) => {
    const currentValues = form.getValues(fieldName) || [];
    form.setValue(
      fieldName,
      currentValues.filter((_: any, i: number) => i !== index),
      { shouldValidate: true, shouldDirty: true },
    );
  };

  return (
    <FormItem>
      <FormLabel>{config?.label || humanizeFieldName(fieldName)}</FormLabel>
      {config?.description && (
        <FormDescription>{config.description}</FormDescription>
      )}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={config?.placeholder || "Add item"}
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
              key={`${fieldName}-${index}-${item}`}
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

// Multi-checkbox field component
function MultiCheckboxField({
  fieldName,
  form,
  config,
  options,
}: {
  fieldName: string;
  form: any;
  config?: FieldOptions;
  options: { label: string; value: string }[];
}) {
  const fieldValue = form.watch(fieldName) || [];

  const handleToggle = (value: string) => {
    const currentValues = form.getValues(fieldName) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v: string) => v !== value)
      : [...currentValues, value];
    form.setValue(fieldName, newValues, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const toggleAll = () => {
    const currentValues = form.getValues(fieldName) || [];
    const allValues = options.map((opt) => opt.value);
    const hasAll = allValues.every((val) => currentValues.includes(val));
    form.setValue(fieldName, hasAll ? [] : allValues, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <FormItem>
      <div className="mb-2 flex items-center justify-between">
        <FormLabel>{config?.label || humanizeFieldName(fieldName)}</FormLabel>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleAll}
          className="h-auto p-1 text-xs"
        >
          {fieldValue.length === options.length ? "Deselect All" : "Select All"}
        </Button>
      </div>
      {config?.description && (
        <FormDescription>{config.description}</FormDescription>
      )}
      <div className="bg-muted/10 grid grid-cols-1 gap-2 rounded-lg border p-3">
        {options.map((option) => (
          <label
            key={option.value}
            className="hover:bg-muted/50 flex cursor-pointer items-center space-x-2 rounded p-2 transition-colors"
          >
            <input
              type="checkbox"
              checked={fieldValue.includes(option.value)}
              onChange={() => handleToggle(option.value)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
      <FormMessage />
    </FormItem>
  );
}

// Generic field renderer
function renderField<T extends Record<string, any>>(
  fieldName: keyof T,
  fieldSchema: z.ZodTypeAny,
  form: any,
  config?: FieldOptions,
) {
  // Handle hidden fields
  if (config?.hidden) return null;

  // Unwrap optional types
  let innerSchema = fieldSchema;
  if (
    fieldSchema instanceof z.ZodOptional ||
    fieldSchema instanceof z.ZodDefault
  ) {
    const def: any = (fieldSchema as any)._def;
    innerSchema = def.innerType ?? def.schema;
  }

  // Array types
  if (innerSchema instanceof z.ZodArray) {
    const itemSchema = innerSchema._def.type;

    // Multi-select for enum arrays
    if (itemSchema instanceof z.ZodEnum && config?.options) {
      return (
        <MultiCheckboxField
          fieldName={String(fieldName)}
          form={form}
          config={config}
          options={config.options}
        />
      );
    }

    // Default array field for string arrays
    return (
      <ArrayField fieldName={String(fieldName)} form={form} config={config} />
    );
  }

  // Standard form fields
  return (
    <FormField
      control={form.control}
      name={String(fieldName)}
      render={({ field }) => {
        // Ensure controlled value
        const controlledValue =
          field.value !== undefined
            ? field.value
            : innerSchema instanceof z.ZodBoolean
              ? false
              : innerSchema instanceof z.ZodNumber
                ? 0
                : innerSchema instanceof z.ZodArray
                  ? []
                  : "";

        // Boolean fields (Switch)
        if (innerSchema instanceof z.ZodBoolean) {
          return (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  {config?.label || humanizeFieldName(String(fieldName))}
                </FormLabel>
                {config?.description && (
                  <FormDescription>{config.description}</FormDescription>
                )}
              </div>
              <FormControl>
                <Switch
                  checked={controlledValue}
                  onCheckedChange={field.onChange}
                  disabled={config?.disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }

        // Enum fields (Select)
        if (innerSchema instanceof z.ZodEnum && config?.options) {
          return (
            <FormItem>
              <FormLabel>
                {config?.label || humanizeFieldName(String(fieldName))}
              </FormLabel>
              {config?.description && (
                <FormDescription>{config.description}</FormDescription>
              )}
              <Select
                onValueChange={field.onChange}
                value={controlledValue}
                disabled={config?.disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={config?.placeholder || "Select an option"}
                    />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {config.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          );
        }

        // Text fields
        return (
          <FormItem>
            <FormLabel>
              {config?.label || humanizeFieldName(String(fieldName))}
            </FormLabel>
            {config?.description && (
              <FormDescription>{config.description}</FormDescription>
            )}
            <FormControl>
              {config?.type === "textarea" || config?.rows ? (
                <Textarea
                  {...field}
                  value={controlledValue}
                  placeholder={config?.placeholder}
                  rows={config?.rows || 3}
                  disabled={config?.disabled}
                />
              ) : (
                <Input
                  {...field}
                  value={controlledValue}
                  type={config?.type || "text"}
                  placeholder={config?.placeholder}
                  disabled={config?.disabled}
                />
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
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
  // Generate complete default values from schema
  const schemaDefaults =
    schema instanceof z.ZodObject
      ? Object.entries(schema.shape).reduce((acc, [key, value]) => {
        acc[key] = getDefaultValue(value as z.ZodTypeAny);
        return acc;
      }, {} as any)
      : {};

  const form = useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...schemaDefaults,
      ...defaultValues,
    } as any,
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
              (fieldConfig as Record<string, FieldOptions>)[fieldName],
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

// Export helper hook for easier form creation
export function useGeneratedForm<T extends z.ZodType<any, any>>(
  schema: T,
  config?: {
    fieldConfig?: FieldConfig<z.infer<T>>;
    defaultValues?: Partial<z.infer<T>>;
  },
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
          } as FieldConfig<z.infer<T>>
        }
        defaultValues={
          {
            ...(config?.defaultValues ?? {}),
            ...(props.defaultValues ?? {}),
          } as Partial<z.infer<T>>
        }
      />
    ),
  };
}
