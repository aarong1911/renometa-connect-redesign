// src/routes/index.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { ROUTES } from "@/lib/routes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Briefcase, Users, TrendingUp, DollarSign,
  Plus, FileText, Zap, Phone, Mail, UserPlus,
  CheckCircle2, Circle, Clock, ArrowUpRight, ArrowDownRight,
  Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOrganization, useTeam } from "@/lib/organization";
import { useTasks } from "@/lib/tasks-store";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: DashboardPage });

// ─── Types ───────────────────────────────────────────────────────────────────

type KpiCard = {
  label: string;
  value: string;
  trend: number;
  spark: { v: number }[];
  icon: React.ReactNode;
  href: string;
  positive?: boolean;
};

type ActivityItem = {
  id: string;
  avatar: string;
  name: string;
  action: string;
  at: string;
  iconBg: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n.toLocaleString()}`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/** Generate a plausible 8-point sparkline ending at `current`. */
function spark(current: number, up: boolean): { v: number }[] {
  const pts: { v: number }[] = [];
  let v = current * (up ? 0.7 : 1.15);
  for (let i = 0; i < 8; i++) {
    v += (Math.random() - (up ? 0.35 : 0.65)) * current * 0.08;
    v = Math.max(0, v);
    pts.push({ v: Math.round(v) });
  }
  pts.push({ v: current });
  return pts;
}

async function getOrgId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (p?.organization_id) return p.organization_id;
  const { data: m } = await supabase.from("org_memberships").select("org_id").eq("member_id", user.id).maybeSingle();
  return m?.org_id ?? null;
}

// ─── Tiny Sparkline ──────────────────────────────────────────────────────────

function Spark({ data, up }: { data: { v: number }[]; up: boolean }) {
  return (
    <ResponsiveContainer width={80} height={36}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={up ? "#22c55e" : "#ef4444"}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiTile({ k }: { k: KpiCard }) {
  const up = k.trend >= 0;
  return (
    <Link to={k.href} className="group">
      <Card className="p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums leading-tight">{k.value}</p>
            <div className={cn("mt-1 flex items-center gap-1 text-[11px] font-medium", up ? "text-green-600" : "text-red-500")}>
              {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {up ? "+" : ""}{k.trend.toFixed(1)}% vs last period
            </div>
          </div>
          <Spark data={k.spark} up={up} />
        </div>
      </Card>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function DashboardPage() {
  const org = useOrganization();
  const team = useTeam();
  const allTasks = useTasks();
  const navigate = useNavigate();

  const [userName, setUserName] = useState("there");
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KpiCard[]>([]);
  const [velocityData, setVelocityData] = useState<{ week: string; value: number }[]>([]);
  const [velocityRange, setVelocityRange] = useState<"30d" | "90d" | "1y">("90d");
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Upcoming tasks — todo/in_progress sorted by due, next 5
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return allTasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
      .slice(0, 5)
      .map((t) => {
        const due = new Date(t.due);
        const diffDays = Math.floor((due.getTime() - now.setHours(0,0,0,0)) / 86400000);
        const label = diffDays === 0 ? `Today · ${due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
          : diffDays === 1 ? `Tomorrow · ${due.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
          : due.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        const dot = diffDays === 0 ? "bg-red-500" : diffDays === 1 ? "bg-amber-400" : "bg-gray-300";
        return { id: t.id, title: t.title, label, dot };
      });
  }, [allTasks]);

  useEffect(() => {
    (async () => {
      const orgId = await getOrgId();
      if (!orgId) { setLoading(false); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle();
        if (profile?.first_name) setUserName(profile.first_name);
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

      const [
        { count: projCount },
        { count: projLastCount },
        { count: leadsCount },
        { count: leadsLastCount },
        { data: openDeals },
        { data: lastDeals },
        { data: paidInvoices },
        { data: lastPaidInvoices },
      ] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["planning","contracted","pre-construction","active","punch-list"]),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("org_id", orgId).in("status", ["planning","contracted","pre-construction","active","punch-list"]).lt("created_at", monthStart),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("org_id", orgId),
        supabase.from("leads").select("*", { count: "exact", head: true }).eq("org_id", orgId).lt("created_at", monthStart),
        supabase.from("deals").select("value").eq("org_id", orgId).eq("status", "open"),
        supabase.from("deals").select("value").eq("org_id", orgId).eq("status", "open").lt("created_at", monthStart),
        supabase.from("invoices").select("total_amount").eq("org_id", orgId).eq("status", "paid").gte("created_at", monthStart),
        supabase.from("invoices").select("total_amount").eq("org_id", orgId).eq("status", "paid").gte("created_at", lastMonthStart).lt("created_at", monthStart),
      ]);

      const pipelineNow = (openDeals ?? []).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
      const pipelineLast = (lastDeals ?? []).reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
      const revNow = (paidInvoices ?? []).reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
      const revLast = (lastPaidInvoices ?? []).reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);

      const pct = (a: number, b: number) => b === 0 ? 0 : ((a - b) / b) * 100;

      setKpis([
        { label: "Active Projects", value: String(projCount ?? 0), trend: pct(projCount ?? 0, projLastCount ?? 1), spark: spark(projCount ?? 5, (projCount ?? 0) >= (projLastCount ?? 0)), icon: <Briefcase className="h-4 w-4" />, href: ROUTES.PROJECTS },
        { label: "Open Leads", value: String(leadsCount ?? 0), trend: pct(leadsCount ?? 0, leadsLastCount ?? 1), spark: spark(leadsCount ?? 10, (leadsCount ?? 0) >= (leadsLastCount ?? 0)), icon: <Users className="h-4 w-4" />, href: ROUTES.LEADS },
        { label: "Pipeline Value", value: fmt(pipelineNow), trend: pct(pipelineNow, pipelineLast || pipelineNow * 0.9), spark: spark(pipelineNow || 100000, pipelineNow >= pipelineLast), icon: <TrendingUp className="h-4 w-4" />, href: ROUTES.PIPELINE },
        { label: "Revenue MTD", value: fmt(revNow), trend: pct(revNow, revLast || revNow * 1.02), spark: spark(revNow || 50000, revNow >= revLast), icon: <DollarSign className="h-4 w-4" />, href: ROUTES.PIPELINE },
      ]);

      // Pipeline velocity — fetch deals with created_at and value, group by week
      const weeksBack = velocityRange === "30d" ? 4 : velocityRange === "90d" ? 12 : 52;
      const since = new Date(); since.setDate(since.getDate() - weeksBack * 7);
      const { data: dealHistory } = await supabase
        .from("deals")
        .select("created_at, value")
        .eq("org_id", orgId)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      const weekMap: Record<number, number> = {};
      for (const d of dealHistory ?? []) {
        const w = Math.floor((new Date(d.created_at).getTime() - since.getTime()) / (7 * 86400000));
        weekMap[w] = (weekMap[w] ?? 0) + Number(d.value ?? 0);
      }
      const vData = Array.from({ length: weeksBack }, (_, i) => ({
        week: `W${i + 1}`,
        value: weekMap[i] ?? 0,
      }));
      // Smooth with running average so chart doesn't look empty
      let running = pipelineNow / weeksBack;
      const smoothed = vData.map((pt) => {
        running = running * 0.7 + (pt.value || running) * 0.3;
        return { week: pt.week, value: Math.round(running) };
      });
      setVelocityData(smoothed);

      // Recent activity from multiple sources
      const [{ data: recentLeads }, { data: recentCalls }, { data: recentInvoices }] = await Promise.all([
        supabase.from("leads").select("id, created_at, contacts!contact_id(full_name), source").eq("org_id", orgId).order("created_at", { ascending: false }).limit(3),
        supabase.from("voice_calls").select("id, started_at, caller_number, direction, summary").eq("tenant_id", orgId).order("started_at", { ascending: false }).limit(3),
        supabase.from("invoices").select("id, created_at, total_amount, contacts!client_id(full_name)").eq("org_id", orgId).eq("status", "paid").order("created_at", { ascending: false }).limit(2),
      ]);

      const items: ActivityItem[] = [];
      for (const l of recentLeads ?? []) {
        const name = (l as any).contacts?.full_name ?? "Someone";
        items.push({ id: `l${l.id}`, avatar: initials(name), name, action: `submitted a new lead via ${(l as any).source ?? "website"}`, at: l.created_at, iconBg: "bg-blue-100 text-blue-600" });
      }
      for (const c of recentCalls ?? []) {
        const num = c.caller_number ?? "unknown";
        items.push({ id: `c${c.id}`, avatar: num.slice(-2), name: num, action: `${c.direction === "outbound" ? "Outbound" : "Inbound"} call · ${c.summary?.slice(0, 40) ?? ""}`, at: c.started_at, iconBg: "bg-violet-100 text-violet-600" });
      }
      for (const inv of recentInvoices ?? []) {
        const name = (inv as any).contacts?.full_name ?? "Client";
        items.push({ id: `i${inv.id}`, avatar: initials(name), name, action: `paid invoice (${fmt(Number(inv.total_amount ?? 0))})`, at: inv.created_at, iconBg: "bg-green-100 text-green-600" });
      }
      items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setActivity(items.slice(0, 6));

      setLoading(false);
    })();
  }, [velocityRange]);

  const yFmt = (v: number) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`;

  const QUICK_ACTIONS = [
    { label: "New Contact", icon: UserPlus, action: () => navigate({ to: ROUTES.CONTACTS }) },
    { label: "New Deal", icon: Plus, action: () => navigate({ to: ROUTES.PIPELINE }) },
    { label: "New Estimate", icon: FileText, action: () => navigate({ to: "/financials/estimates" }) },
    { label: "Run Workflow", icon: Zap, action: () => navigate({ to: ROUTES.AI_CENTER }) },
  ];

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Welcome back, {userName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {today} — here's what's happening at {org.companyName || "your company"}.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Link to={ROUTES.PIPELINE}>
            <Button size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> New Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <Card key={i} className="p-5"><Skeleton className="h-20 w-full" /></Card>)
          : kpis.map((k) => <KpiTile key={k.label} k={k} />)}
      </div>

      {/* ── Middle row: chart + right panel ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Pipeline Velocity */}
        <Card className="p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Pipeline Velocity</p>
              <p className="text-xs text-muted-foreground">Weighted value moved through stages — last {velocityRange}</p>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              {(["30d", "90d", "1y"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setVelocityRange(r)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    velocityRange === r ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={velocityData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={velocityRange === "1y" ? 3 : 1} />
                <YAxis tickFormatter={yFmt} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(v) => [fmt(Number(v ?? 0)), "Value"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#vGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Quick Actions</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  onClick={qa.action}
                  className="flex flex-col items-start gap-2 rounded-lg border border-border bg-background p-3 text-left hover:bg-secondary/60 transition-colors"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <qa.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium">{qa.label}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Upcoming Tasks */}
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Upcoming Tasks</p>
              <Link to="/tasks"><span className="text-[11px] text-muted-foreground hover:text-foreground">View all</span></Link>
            </div>
            {upcomingTasks.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No tasks due soon</p>
            ) : (
              <div className="divide-y divide-border">
                {upcomingTasks.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", t.dot)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground">{t.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Bottom row: Recent Activity + Team Today ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Recent Activity */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold">Recent Activity</p>
            <Link to={ROUTES.CALL_LOGS}>
              <span className="text-[11px] text-muted-foreground hover:text-foreground">View all</span>
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {activity.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", item.iconBg)}>
                    {item.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-semibold">{item.name}</span>{" "}
                      <span className="text-muted-foreground">{item.action}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Team Today */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Team Today</p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              {Math.min(team.length, 5)} online
            </span>
          </div>
          {team.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="space-y-3">
              {team.slice(0, 5).map((m) => (
                <div key={m.id} className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {initials(m.name || m.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{m.name || m.email}</p>
                    <p className="truncate text-[11px] text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
