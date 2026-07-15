// src/components/layout/sidebar.tsx
import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Building2, Target, Briefcase, ListTodo, Calendar, FolderOpen,
  Inbox, MessageSquare, Megaphone, Workflow, Bot, Bell, Receipt, FileText,
  CreditCard, BarChart3, TrendingUp, Trophy, Settings, ChevronLeft, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useFavoriteOptions } from "@/lib/favorites";
import { useCurrentUserRole, filterNavGroups, canAccessSettings } from "@/lib/permissions";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const ALL_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "CRM",
    items: [
      { to: "/contacts",       label: "Contacts",  icon: Users },
      { to: "/companies",      label: "Companies", icon: Building2 },
      { to: "/leads",          label: "Leads",     icon: Target },
      { to: "/sales/pipeline", label: "Pipeline",  icon: TrendingUp },
    ],
  },
  {
    label: "Projects",
    items: [
      { to: "/projects",  label: "Projects",  icon: Briefcase },
      { to: "/tasks",     label: "Tasks",     icon: ListTodo },
      { to: "/calendar",  label: "Calendar",  icon: Calendar },
      { to: "/files",     label: "Files",     icon: FolderOpen },
    ],
  },
  {
    label: "Inbox",
    items: [
      { to: "/inbox",            label: "Conversations", icon: Inbox },
      { to: "/inbox/templates",  label: "Templates",     icon: MessageSquare },
      { to: "/inbox/broadcasts", label: "Broadcasts",    icon: Megaphone },
    ],
  },
  {
    label: "Automation",
    items: [
      { to: ROUTES.WORKFLOWS, label: "Workflows", icon: Workflow },
      { to: ROUTES.AI_CENTER, label: "AI Center", icon: Bot },
      { to: ROUTES.TRIGGERS,  label: "Triggers",  icon: Bell },
    ],
  },
  {
    label: "Financials",
    items: [
      { to: "/financials/estimates", label: "Estimates", icon: FileText },
      { to: "/financials/invoices",  label: "Invoices",  icon: Receipt },
      { to: "/financials/payments",  label: "Payments",  icon: CreditCard },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/insights/analytics",  label: "Analytics",  icon: BarChart3 },
      { to: "/insights/reputation", label: "Reputation", icon: Trophy },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location  = useLocation();
  const pathname  = location.pathname;
  const favorites = useFavoriteOptions();
  const role      = useCurrentUserRole();

  // Don't render any nav items until role is resolved — prevents full
  // sidebar flash on first login before permissions are known.
  const groups           = role === null ? [] : filterNavGroups(ALL_GROUPS, role);
  const visibleFavorites = role === null ? [] : (filterNavGroups(
    [{ label: "fav", items: favorites }], role
  )[0]?.items ?? []);
  const showSettings = role === null ? false : canAccessSettings(role);

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/");

  const isNavActive = (to: string) =>
    to === "/inbox"
      ? pathname === "/inbox" || pathname === "/inbox/"
      : isActive(to);

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "fixed left-0 top-14 bottom-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-16" : "w-60",
      )}>
        <div className="border-b border-sidebar-border p-2">
          <Button variant="ghost" size="sm" onClick={onToggle}
            className="w-full justify-start text-muted-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
            {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
          {visibleFavorites.length > 0 && (
            <div className={cn("mb-3", collapsed ? "" : "px-2")}>
              {!collapsed && (
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Pin className="h-3 w-3" /> Favorites
                </div>
              )}
              <div className="space-y-0.5">
                {visibleFavorites.map(item => (
                  <NavLinkRow key={item.to} item={item} active={isNavActive(item.to)} collapsed={collapsed} />
                ))}
              </div>
              {collapsed && <div className="my-2 border-t border-sidebar-border" />}
            </div>
          )}

          {groups.map((group, gi) => (
            <div key={group.label} className={cn("mb-1", gi > 0 && "mt-3")}>
              {!collapsed && (
                <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <NavLinkRow key={item.to} item={item} active={isNavActive(item.to)} collapsed={collapsed} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {showSettings && (
          <div className="border-t border-sidebar-border p-2">
            <NavLinkRow
              item={{ to: "/settings", label: "Settings", icon: Settings }}
              active={isActive("/settings")} collapsed={collapsed} />
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function NavLinkRow({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const content = (
    <Link to={item.to} className={cn(
      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
      active
        ? "bg-sidebar-active text-sidebar-active-foreground"
        : "text-sidebar-foreground hover:bg-secondary hover:text-foreground",
      collapsed && "justify-center px-0",
    )}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary" />}
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return content;
}