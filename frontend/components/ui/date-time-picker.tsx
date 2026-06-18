"use client";

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DateTimePickerProps {
  date?: string;
  setDate: (date: string) => void;
  label?: string;
  placeholder?: string;
}

export function DateTimePicker({
  date,
  setDate,
  label,
  placeholder = "Pick a date",
}: DateTimePickerProps) {
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined;
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : undefined;
  }, [date]);

  const handleDateSelect = (newDate: Date | undefined) => {
    if (!newDate) return;
    
    const current = selectedDate || new Date();
    const result = new Date(newDate);
    result.setHours(current.getHours());
    result.setMinutes(current.getMinutes());
    result.setSeconds(0);
    result.setMilliseconds(0);
    
    setDate(result.toISOString());
  };

  const handleTimeChange = (type: "hours" | "minutes", value: string) => {
    const current = selectedDate || new Date();
    const result = new Date(current);
    
    if (type === "hours") {
      result.setHours(parseInt(value));
    } else {
      result.setMinutes(parseInt(value));
    }
    
    setDate(result.toISOString());
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-semibold text-[var(--color-text-secondary)]">
          {label}
        </label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(selectedDate!, "PPP HH:mm") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            initialFocus
          />
          <div className="p-3 border-t border-border flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1">
              <Select
                value={selectedDate ? selectedDate.getHours().toString().padStart(2, "0") : "00"}
                onValueChange={(v) => handleTimeChange("hours", v)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="HH" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }).map((_, i) => (
                    <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                      {i.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">:</span>
              <Select
                value={selectedDate ? selectedDate.getMinutes().toString().padStart(2, "0") : "00"}
                onValueChange={(v) => handleTimeChange("minutes", v)}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue placeholder="MM" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 60 }).map((_, i) => (
                    <SelectItem key={i} value={i.toString().padStart(2, "0")}>
                      {i.toString().padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
