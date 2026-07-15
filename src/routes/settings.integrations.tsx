// src/routes/settings.integrations.tsx
import { useState, useMemo, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link2, Search, Plug, CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { INTEGRATIONS, CATEGORIES, type Integration, type CategoryId } from "@/lib/integrations-data";
import { IntegrationConfigDrawer } from "@/components/integrations/integration-config-drawer";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings/integrations")({
  component: IntegrationsSettings,
});

function IntegrationsSettings() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<Integration | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [disconnectTarget, setDisconnectTarget] = useState<Integration | null>(null);

  // Load real connection status from org's integration_settings + meta_connections
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
      const orgId = profile?.organization_id;
      if (!orgId) return;

      const { data: org } = await supabase.from("organizations").select("integration_settings").eq("id", orgId).maybeSingle();
      const settings: Record<string, any> = org?.integration_settings ?? {};

      const { data: { session } } = await supabase.auth.getSession();
      let connectedProducts: string[] = [];
      if (session) {
        try {
          const res = await fetch("/.netlify/functions/meta-connection-status", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const json = await res.json();
            // Per-product schema (see
            // supabase/migrations/006_meta_connections_per_product.sql) —
            // meta-connection-status.ts now returns `connections` keyed by
            // product (e.g. { whatsapp: {...}, ads: {...} }), one entry
            // per product that's actually connected. A product's presence
            // as a key means it's connected; there's no shared array to
            // check membership against anymore.
            connectedProducts = Object.keys(json.connections ?? {});
          }
        } catch {
          // Meta connection status is best-effort here — card will just show "Not connected"
        }
      }

      const metaProductMap: Record<string, string> = {
        whatsapp: "whatsapp",
        "fb-messenger": "messenger",
        "instagram-direct": "instagram",
        "meta-lead-ads": "lead_ads",
        "meta-ads": "ads",
      };

      setIntegrations((prev) =>
        prev.map((i) => {
          if (metaProductMap[i.id]) {
            return { ...i, connected: connectedProducts.includes(metaProductMap[i.id]) };
          }
          const key = i.id.replace(/-/g, "_");
          const saved = settings[key];
          return { ...i, connected: !!saved && typeof saved === "object" && Object.keys(saved).length > 0 };
        })
      );
    })();
  }, []);

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.vendor.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, category, integrations]);

  const total = integrations.length;
  const connectedCount = integrations.filter((i) => i.connected).length;
  const availableCount = total - connectedCount;

  const updateConnectionStatus = useCallback((id: string, connected: boolean) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.id === id ? { ...i, connected } : i))
    );
  }, []);

  const handleConnect = useCallback((integration: Integration) => {
    updateConnectionStatus(integration.id, true);
    toast.success(`${integration.name} connected successfully`);
    setDrawerOpen(false);
  }, [updateConnectionStatus]);

  const handleDisconnect = useCallback(() => {
    if (!disconnectTarget) return;
    updateConnectionStatus(disconnectTarget.id, false);
    toast.success(`${disconnectTarget.name} disconnected`);
    setDisconnectTarget(null);
  }, [disconnectTarget, updateConnectionStatus]);

  const openDrawer = (i: Integration) => {
    setSelected(i);
    setDrawerOpen(true);
  };

  const actionLabel = (i: Integration) => {
    if (i.connected) return null;
    if (i.connectMethod === "oauth") return "Connect";
    if (i.connectMethod === "apikey") return "Configure";
    return "Get Started";
  };

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Plug className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none">{total}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Total Integrations</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-success">{connectedCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Connected</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Circle className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold leading-none text-primary">{availableCount}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Available</p>
          </div>
        </Card>
      </div>

      {/* Search + category pills */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((i) => (
          <Card key={i.id} className="flex flex-col p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary">
                <Link2 className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold leading-tight">{i.name}</span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "h-5 shrink-0 rounded-full px-1.5 text-[10px]",
                      i.connected
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{i.vendor}</p>
              </div>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{i.description}</p>

            <div className="mt-2 flex flex-wrap gap-1">
              {i.syncBadges.map((b) => (
                <span key={b} className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {b}
                </span>
              ))}
            </div>

            {i.connected && i.automations && i.automations.length > 0 && (
              <div className="mt-3 rounded-md border border-border bg-muted/50 p-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Automations</p>
                <ul className="space-y-0.5">
                  {i.automations.map((a) => (
                    <li key={a} className="flex items-start gap-1.5 text-[11px] text-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto flex gap-2 pt-3">
              {i.connected ? (
                <>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openDrawer(i)}>Configure</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setDisconnectTarget(i)}>Disconnect</Button>
                </>
              ) : (
                <Button size="sm" className="h-7 text-xs" onClick={() => openDrawer(i)}>
                  {actionLabel(i)}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No integrations found.
        </div>
      )}

      <IntegrationConfigDrawer
        integration={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onConnect={handleConnect}
        onDisconnect={(integration) => {
          updateConnectionStatus(integration.id, false);
          setDrawerOpen(false);
        }}
      />

      <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Disconnect {disconnectTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the connection to {disconnectTarget?.vendor}. Any active automations using this integration will stop working. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}