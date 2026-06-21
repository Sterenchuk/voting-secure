"use client";

import * as React from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupFieldProps {
  options: RadioOption[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  className?: string;
  itemClassName?: string;
}

export function RadioGroupField({
  options,
  value,
  onValueChange,
  label,
  className,
  itemClassName,
}: RadioGroupFieldProps) {
  return (
    <div className={cn("grid gap-3", className)}>
      {label && <Label className="text-sm font-semibold mb-1">{label}</Label>}
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className="flex flex-col gap-2"
      >
        {options.map((option) => (
          <div
            key={option.value}
            className={cn(
              "flex items-start space-x-3 space-y-0 rounded-md border p-3 cursor-pointer transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
              itemClassName,
            )}
            onClick={() => onValueChange(option.value)}
          >
            <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor={option.value}
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {option.label}
              </Label>
              {option.description && (
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
