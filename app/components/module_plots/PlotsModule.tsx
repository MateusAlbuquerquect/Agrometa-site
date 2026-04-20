"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Plus, X, ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";

// =============================================================================
// Types
// =============================================================================
interface Plot {
  id: string;
  name: string;
  variety: string | null;
  area_ha: number | null;
  cut_cycle: number | null;
}

interface Operation {
  id: string;
  type: string;
  started_at: string;
  notes: string | null;
  machines?: { name: string } | null;
  operator?: { full_name: string } | null;
}

// =============================================================================
// Modal: Novo / Editar Lote
// =============================================================================
function PlotModal({
  farmId,
  plot,
  onClose,
  onSaved,
}: {
  farmId: string;
  plot?: Plot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const isEdit = !!plot;
  const [name, setName]         = useState(plot?.name ?? "");
  const [variety, setVariety]   = useState(plot?.variety ?? "");
  const [area, setArea]         = useState(plot?.area_ha?.toString() ?? "");
  const [cycle, setCycle]       = useState(plot?.cut_cycle?.toString() ?? "1");
  const [loading, setLoading]   = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);

    const payload = {
      farm_id:   farmId,
      name:      name.trim(),
      variety:   variety.trim() || null,
      area_ha:   parseFloat(area) || null,
      cut_cycle: parseInt(cycle) || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = isEdit
      ? await supabase.from("plots").update(payload).eq("id", plot!.id)
      : await supabase.from("plots").insert(payload);

    setLoading(false);
    if (!error) { onSaved(); onClose(); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Editar Lote" : "Novo Lote"}</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label">Nome do Talhão</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="Ex: Talhão 01"
            />
          </div>

          <div className="field">
            <label className="field-label">Variedade</label>
            <input
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
              className="field-input"
              placeholder="Ex: RB92579, SP81-3250"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Área (ha)</label>
              <input
                type="number"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="field-input"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div className="field">
              <label className="field-label">Corte</label>
              <div className="select-wrapper">
                <select
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value)}
                  className="field-select"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}º Corte</option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="modal-submit"
        >
          {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar Lote"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// PlotCard — card do lote com accordion de histórico
// =============================================================================
function PlotCard({
  plot,
  farmId,
  onEdit,
}: {
  plot: Plot;
  farmId: string;
  onEdit: (p: Plot) => void;
}) {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [expanded, setExpanded]     = useState(false);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);

  async function loadHistory() {
    if (operations.length > 0) { setExpanded(true); return; }
    setLoadingOps(true);
    const { data } = await supabase
      .from("operations")
      .select(`
        id, type, started_at, notes,
        machines(name)
      `)
      .eq("plot_id", plot.id)
      .order("started_at", { ascending: false })
      .limit(20);
    if (data) setOperations(data as unknown as Operation[]);
    setLoadingOps(false);
    setExpanded(true);
  }

  function toggleHistory() {
    if (expanded) { setExpanded(false); return; }
    loadHistory();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const OP_LABELS: Record<string, string> = {
    aplicacao: "Aplicação", plantio: "Plantio", colheita: "Colheita",
    gradagem: "Gradagem", pulverizacao: "Pulverização",
    transporte: "Transporte", outro: "Outro",
  };

  return (
    <div className="plot-card">
      {/* Cabeçalho do card */}
      <div className="plot-card-top">
        <div className="plot-info">
          <p className="plot-name">{plot.name}</p>
          <p className="plot-meta">
            {plot.variety ?? "—"}
            {plot.area_ha ? ` · ${plot.area_ha}ha` : ""}
            {plot.cut_cycle ? ` · ${plot.cut_cycle}º corte` : ""}
          </p>
        </div>
        <div className="plot-actions">
          <button
            className="plot-btn-edit"
            onClick={() => onEdit(plot)}
            title="Editar lote"
          >
            <Pencil size={14} />
          </button>
          <button
            className="plot-btn-history"
            onClick={toggleHistory}
            title="Ver histórico"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            <span>Histórico</span>
          </button>
        </div>
      </div>

      {/* Accordion: histórico de operações */}
      {expanded && (
        <div className="plot-history">
          {loadingOps ? (
            <p className="history-empty">Carregando...</p>
          ) : operations.length === 0 ? (
            <p className="history-empty">Nenhuma operação registrada.</p>
          ) : (
            <div className="history-list">
              {operations.map((op) => (
                <div key={op.id} className="history-item">
                  <div className="history-item-left">
                    <span className="history-type">
                      {OP_LABELS[op.type] ?? op.type}
                    </span>
                    {op.machines && (
                      <span className="history-machine">
                        🚜 {op.machines.name}
                      </span>
                    )}
                    {op.notes && (
                      <span className="history-notes">{op.notes}</span>
                    )}
                  </div>
                  <span className="history-date">{formatDate(op.started_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PlotsModule — componente principal
// =============================================================================
export function PlotsModule() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const [farmId, setFarmId]         = useState<string | null>(null);
  const [plots, setPlots]           = useState<Plot[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingPlot, setEditingPlot] = useState<Plot | undefined>(undefined);

  useEffect(() => {
    async function loadFarm() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("farm_members")
        .select("farm_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();
      if (data) setFarmId(data.farm_id);
    }
    loadFarm();
  }, [supabase]);

  const fetchPlots = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    const { data } = await supabase
      .from("plots")
      .select("id, name, variety, area_ha, cut_cycle")
      .eq("farm_id", farmId)
      .order("name");
    if (data) setPlots(data);
    setLoading(false);
  }, [farmId, supabase]);

  useEffect(() => { fetchPlots(); }, [fetchPlots]);

  function openEdit(plot: Plot) {
    setEditingPlot(plot);
    setShowModal(true);
  }

  function openNew() {
    setEditingPlot(undefined);
    setShowModal(true);
  }

  return (
    <div className="plots-root">
      <div className="plots-header">
        <h1 className="plots-title">Talhões</h1>
        <button
          onClick={openNew}
          className="btn-primary"
          disabled={!farmId}
        >
          <Plus size={16} /> Novo Talhão
        </button>
      </div>

      {loading ? (
        <div className="loading">Carregando talhões...</div>
      ) : plots.length === 0 ? (
        <div className="empty">Nenhum talhão cadastrado. Adicione o primeiro.</div>
      ) : (
        <div className="plots-list">
          {plots.map((plot) => (
            <PlotCard
              key={plot.id}
              plot={plot}
              farmId={farmId!}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {showModal && farmId && (
        <PlotModal
          farmId={farmId}
          plot={editingPlot}
          onClose={() => setShowModal(false)}
          onSaved={fetchPlots}
        />
      )}

      <style>{`
        .plots-root {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }

        .plots-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .plots-title {
          font-family: var(--font-data);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }

        .btn-primary {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--color-accent);
          color: #0d1a0d;
          border: none;
          border-radius: var(--radius);
          font-family: var(--font-ui);
          font-size: 13px;
          font-weight: 600;
          padding: 8px 14px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

        .plots-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Plot Card */
        .plot-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-left: 3px solid var(--color-accent-dim);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .plot-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          gap: 10px;
        }

        .plot-info { flex: 1; overflow: hidden; }

        .plot-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .plot-meta {
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .plot-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .plot-btn-edit {
          background: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text-muted);
          padding: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: color 0.15s, border-color 0.15s;
        }
        .plot-btn-edit:hover { color: var(--color-accent); border-color: var(--color-accent); }

        .plot-btn-history {
          background: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text-muted);
          padding: 6px 10px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          transition: color 0.15s, border-color 0.15s;
        }
        .plot-btn-history:hover { color: var(--color-text); }

        /* Accordion Histórico */
        .plot-history {
          border-top: 1px solid var(--color-border);
          background: var(--color-surface-2);
          padding: 10px 14px;
        }

        .history-empty {
          font-size: 13px;
          color: var(--color-text-muted);
          text-align: center;
          padding: 8px 0;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
          padding: 8px 10px;
          background: var(--color-surface);
          border-radius: var(--radius);
          border: 1px solid var(--color-border);
        }

        .history-item-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .history-type {
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }

        .history-machine {
          font-size: 11px;
          color: var(--color-accent-dim);
        }

        .history-notes {
          font-size: 11px;
          color: var(--color-text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
        }

        .history-date {
          font-family: var(--font-data);
          font-size: 10px;
          color: var(--color-text-muted);
          flex-shrink: 0;
          white-space: nowrap;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 16px;
        }
        @media (min-width: 480px) { .modal-overlay { align-items: center; } }

        .modal {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 420px;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
        }

        .modal-title {
          font-family: var(--font-data);
          font-size: 16px;
          font-weight: 700;
        }

        .modal-close {
          background: none; border: none; cursor: pointer;
          color: var(--color-text-muted); display: flex; align-items: center; padding: 4px;
        }

        .modal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; }

        .field-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .field-input {
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text);
          font-family: var(--font-data);
          font-size: 15px;
          padding: 10px 12px;
          outline: none;
          width: 100%;
        }
        .field-input:focus { border-color: var(--color-accent); }

        .select-wrapper { position: relative; }
        .field-select {
          appearance: none;
          background: var(--color-surface-2);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text);
          font-family: var(--font-ui);
          font-size: 14px;
          padding: 10px 32px 10px 12px;
          width: 100%;
          outline: none;
        }
        .select-icon {
          position: absolute; right: 10px; top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .modal-submit {
          width: 100%;
          background: var(--color-accent);
          color: #0d1a0d;
          border: none;
          padding: 14px;
          font-family: var(--font-ui);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .modal-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        .loading, .empty {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 14px;
          padding: 40px 0;
        }
      `}</style>
    </div>
  );
}
