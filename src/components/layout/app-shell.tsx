import { useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { Topbar } from "./topbar";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const isAuthRoute =
    pathname === "/signin" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/onboarding" ||
    pathname.startsWith("/auth/");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-canvas">
      <Topbar />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main
        className={cn(
          "pt-14 transition-[padding] duration-200",
          collapsed ? "pl-16" : "pl-60",
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-border-strong">/</span>}
                <span>{b}</span>
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
