import { memo, ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export const AppShell = memo(function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto max-w-md pb-24">{children}</div>
      <BottomNav />
    </div>
  );
});
