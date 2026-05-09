import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LocalInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & {
  value?: string;
  delay?: number;
  formatValue?: (value: string) => string;
  onValueChange?: (value: string) => void;
};

type LocalTextareaProps = Omit<React.ComponentProps<typeof Textarea>, "value" | "defaultValue" | "onChange"> & {
  value?: string;
  delay?: number;
  onValueChange?: (value: string) => void;
};

function useLocalText(value = "", onValueChange?: (value: string) => void, delay = 120) {
  const [localValue, setLocalValue] = React.useState(value);
  const lastSent = React.useRef(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    setLocalValue(value);
    lastSent.current = value;
  }, [value]);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const scheduleValue = React.useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      if (next !== lastSent.current) {
        lastSent.current = next;
        onValueChange?.(next);
      }
    }, delay);
  }, [delay, onValueChange]);

  return { localValue, setLocalValue, scheduleValue };
}

export function LocalInput({ value = "", delay, formatValue, onValueChange, ...props }: LocalInputProps) {
  const { localValue, setLocalValue, scheduleValue } = useLocalText(value, onValueChange, delay);
  return (
    <Input
      {...props}
      value={localValue}
      onChange={(event) => {
        const next = formatValue ? formatValue(event.target.value) : event.target.value;
        setLocalValue(next);
        scheduleValue(next);
      }}
    />
  );
}

export function LocalTextarea({ value = "", delay, onValueChange, ...props }: LocalTextareaProps) {
  const { localValue, setLocalValue, scheduleValue } = useLocalText(value, onValueChange, delay);
  return (
    <Textarea
      {...props}
      value={localValue}
      onChange={(event) => {
        const next = event.target.value;
        setLocalValue(next);
        scheduleValue(next);
      }}
    />
  );
}