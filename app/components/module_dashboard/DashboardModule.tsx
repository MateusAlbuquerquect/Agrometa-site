"use client";

import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { AlertTriangle, Package, ClipboardList, TrendingDown } from "lucide-react";

interface RecentOp {
  id: string;
  activity_type: string;
  operation_date: string;
  notes: string | null;
  plots: { name: string } | null;
  machines: { name: string } | null;
}

interface Stats {
  alertsCritical: number;
  alertsItems: number;
  opsRegistered: number;
  recentConsumption: number;
}

export function DashboardModule() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [stats, setStats] = useState<Stats>({
    alertsCritical: 0,
    alertsItems: 0,
    opsRegistered: 0,
    recentConsumption: 0,
  });
  const [recentOps, setRecentOps] = useState<RecentOp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("farm_members")
        .select("farm_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!member) { setLoading(false); return; }
      const fId = member.farm_id;

      const since30d = new Date(Date.now() - 30 * 86_400_000).toISOString();

      const [{ data: alerts }, { data: ops }, { data: txs }, { data: latest }] =
        await Promise.all([
          supabase
            .from("inventory_alerts")
            .select("id, alert_level")
            .eq("farm_id", fId),
          supabase
            .from("operations")
            .select("id", { count: "exact", head: true })
            .eq("farm_id", fId),
          supabase
            .from("inventory_transactions")
            .select("quantity")
            .eq("farm_id", fId)
            .eq("type", "saida")
            .gte("created_at", since30d),
          supabase
            .from("operations")
            .select(
              "id, activity_type, operation_date, notes, plots(name), machines(name)"
            )
            .eq("farm_id", fId)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

      setStats({
        alertsCritical:
          alerts?.filter(
            (a) => a.alert_level === "critical" || a.alert_level === "empty"
          ).length ?? 0,
        alertsItems: alerts?.length ?? 0,
        opsRegistered: (ops as unknown as { length: number } | null)?.length ?? 0,
        recentConsumption:
          txs?.reduce((sum, t) => sum + Math.abs(t.quantity), 0) ?? 0,
      });

      if (latest) setRecentOps(latest as unknown as RecentOp[]);
      setLoading(false);
    }

    load();
  }, [supabase]);

  const ACTIVITY_LABELS: Record<string, string> = {
    Adubação: "🌱 Adubação",
    Calagem: "🪨 Calagem",
    "Aplicação Herbicida": "☠️ Herbicida",
    "Aplicação Inseticida": "🐛 Inseticida",
    "Nutrição Foliar": "💧 Nutrição Foliar",
    Abastecimento: "⛽ Abastecimento",
    Outro: "📋 Outro",
  };

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  }

  if (loading) {
    return <div className="dash-root"><div className="dash-loading">Carregando...</div></div>;
  }

  return (
    <div className="dash-root">
      <div className="dash-header">
        <h1 className="dash-title">Dashboard</h1>
        <p className="dash-subtitle">Visão geral, alertas e últimas operações</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className={`kpi-card ${stats.alertsCritical > 0 ? "kpi-card--danger" : ""}`}>
          <div className="kpi-top">
            <span className="kpi-label">Alertas críticos</span>
            <AlertTriangle size={18} className="kpi-icon kpi-icon--danger" />
          </div>
          <span className="kpi-value">{stats.alertsCritical}</span>
        </div>

        <div className={`kpi-card ${stats.alertsItems > 0 ? "kpi-card--warn" : ""}`}>
          <div className="kpi-top">
            <span className="kpi-label">Itens com alerta</span>
            <Package size={18} className="kpi-icon kpi-icon--warn" />
          </div>
          <span className="kpi-value">{stats.alertsItems}</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Ops. registradas</span>
            <ClipboardList size={18} className="kpi-icon kpi-icon--accent" />
          </div>
          <span className="kpi-value">{stats.opsRegistered}</span>
        </div>

        <div className="kpi-card">
          <div className="kpi-top">
            <span className="kpi-label">Consumo recente</span>
            <TrendingDown size={18} className="kpi-icon kpi-icon--blue" />
          </div>
          <span className="kpi-value">
            {stats.recentConsumption.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </span>
        </div>
      </div>

      {/* Últimas operações */}
      <div className="recent-card">
        <div className="recent-header">
          <span className="recent-title">↗ Últimas operações</span>
        </div>

        {recentOps.length === 0 ? (
          <p className="recent-empty">
            Nenhuma operação ainda. Use o Boletim para registrar.
          </p>
        ) : (
          <div className="recent-list">
            {recentOps.map((op) => (
              <div key={op.id} className="recent-item">
                <div className="recent-item-left">
                  <span className="recent-activity">
                    {ACTIVITY_LABELS[op.activity_type] ?? op.activity_type}
                  </span>
                  <span className="recent-plot">
                    {op.plots?.name ?? "—"}
                    {op.machines?.name ? ` · 🚜 ${op.machines.name}` : ""}
                  </span>
                  {op.notes && (
                    <span className="recent-notes">{op.notes}</span>
                  )}
                </div>
                <span className="recent-date">{fmtDate(op.operation_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .dash-root {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }

        .dash-loading {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 14px;
          padding: 60px 0;
        }

        .dash-header { display: flex; flex-direction: column; gap: 2px; }
        .dash-title {
          font-family: var(--font-data);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }
        .dash-subtitle { font-size: 13px; color: var(--color-text-muted); }

        /* KPI grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (min-width: 480px) {
          .kpi-grid { grid-template-columns: repeat(4, 1fr); }
        }

        .kpi-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kpi-card--danger { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.04); }
        .kpi-card--warn   { border-color: rgba(250,204,21,0.4);  background: rgba(250,204,21,0.04); }

        .kpi-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }
        .kpi-label {
          font-size: 12px;
          color: var(--color-text-muted);
          font-weight: 500;
          line-height: 1.3;
        }
        .kpi-icon { flex-shrink: 0; }
        .kpi-icon--danger { color: var(--color-danger); }
        .kpi-icon--warn   { color: var(--color-warning); }
        .kpi-icon--accent { color: var(--color-accent-dim); }
        .kpi-icon--blue   { color: #60a5fa; }

        .kpi-value {
          font-family: var(--font-data);
          font-size: 28px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -1px;
        }

        /* Recent ops */
        .recent-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .recent-header {
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border);
          background: var(--color-surface-2);
        }
        .recent-title {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .recent-empty {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 13px;
          padding: 32px 16px;
        }
        .recent-list {
          display: flex;
          flex-direction: column;
        }
        .recent-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--color-border);
        }
        .recent-item:last-child { border-bottom: none; }

        .recent-item-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }
        .recent-activity {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }
        .recent-plot {
          font-size: 11px;
          color: var(--color-accent-dim);
        }
        .recent-notes {
          font-size: 11px;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }
        .recent-date {
          font-family: var(--font-data);
          font-size: 10px;
          color: var(--color-text-muted);
          flex-shrink: 0;
          white-space: nowrap;
          padding-top: 2px;
        }
      `}</style>
    </div>
  );
}
