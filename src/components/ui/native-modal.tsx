import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface NativeModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function NativeModal({ open, title, children, footer, onOpenChange, className }: NativeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/35 px-3 py-3" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="native-modal-title"
        className={cn(
          "relative mx-auto my-3 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-lg border bg-background p-4 text-foreground shadow-sm",
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id="native-modal-title" className="text-lg font-semibold leading-tight">{title}</h2>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground active:bg-accent"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function NativeConfirm({
  open,
  title,
  message,
  confirmLabel = "Continue",
  destructive,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <NativeModal
      open={open}
      title={title}
      onOpenChange={(v) => !v && onCancel()}
      footer={
        <>
          <button type="button" className="h-10 rounded-md border border-input px-4 text-sm font-medium" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className={cn("h-10 rounded-md px-4 text-sm font-medium text-primary-foreground", destructive ? "bg-danger" : "bg-primary")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </NativeModal>
  );
}