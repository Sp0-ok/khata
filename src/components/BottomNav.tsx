import { memo } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Home, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearRadixLocks, nativeLog } from "@/lib/androidStability";

const items: { to: "/" | "/parties" | "/reports"; label: string; icon: typeof Home; exact?: boolean }[] = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/parties", label: "Parties", icon: Users },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

export const BottomNav = memo(function BottomNav() {
  const loc = useLocation();
  return (
    <nav data-hide-when-keyboard="true" className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              preload={false}
              onClick={() => { clearRadixLocks(); nativeLog("nav:bottom", to); }}
              className={cn(
                "flex flex-1 touch-manipulation flex-col items-center gap-1 py-2.5 text-xs font-medium",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
});
