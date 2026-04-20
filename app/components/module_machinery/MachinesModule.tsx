"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Plus, X, ChevronDown, Gauge, Fuel, Wrench, Pencil } from "lucide-react";

// =============================================================================
// Types
// =============================================================================
type MachineType = "trator" | "colheitadeira" | "moto" | "caminhao" | "pulverizador" | "grade" | "outro";
type FuelType = "diesel" | "gasolina" | "flex" | "eletrico";

interface Machine {
  id: string;
  name: string;
  type: MachineType;
  fuel_type: FuelType;
  horimetro_atual: number;
  horimetro_proxima_manutencao?: number;
  placa?: string;
}

interface Plot {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantidade_atual: number;
}

// =============================================================================
// Config visual das máquinas
// =============================================================================
const MACHINE_CONFIG: Record<MachineType, { label: string; emoji: string; color: string }> = {
  trator:        { label: "Trator",        emoji: "🚜", color: "#fb923c" },
  colheitadeira: { label: "Colheitadeira", emoji: "🌾", color: "#facc15" },
  moto:          { label: "Moto",          emoji: "🏍️", color: "#a78bfa" },
  caminhao:      { label: "Caminhão",      emoji: "🚛", color: "#60a5fa" },
  pulverizador:  { label: "Pulverizador",  emoji: "💨", color: "#34d399" },
  grade:         { label: "Grade",         emoji: "⚙️", color: "#9ca3af" },
  outro:         { label: "Outro",         emoji: "🔧", color: "#6b7280" },
};

const FUEL_LABELS: Record<FuelType, string> = {
  diesel: "Diesel", gasolina: "Gasolina", flex: "Flex", eletrico: "Elétrico",
};

// =============================================================================
// Modal: Registrar Operação (Boletim de Campo)
// Integração: baixa combustível do estoque + atualiza horímetro + loga no lote
// =============================================================================
function OperationModal({
  machine,
  farmId,
  onClose,
  onSubmit,
}: {
  machine: Machine;
  farmId: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [fuelItems, setFuelItems] = useState<InventoryItem[]>([]);
  const [plotId, setPlotId] = useState("");
  const [opType, setOpType] = useState("aplicacao");
  const [horimetroInicio, setHorimetroInicio] = useState(
    machine.horimetro_atual.toString()
  );
  const [horimetroFim, setHorimetroFim] = useState("");
  const [fuelItemId, setFuelItemId] = useState("");
  const [fuelQty, setFuelQty] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDeps() {
      const [{ data: plotData }, { data: fuelData }] = await Promise.all([
        supabase.from("plots").select("id, name").eq("farm_id", farmId),
        supabase
          .from("inventory_items")
          .select("id, name, category, unit, quantidade_atual")
          .eq("farm_id", farmId)
          .in("category", [machine.fuel_type, "diesel", "gasolina"])
          .gt("quantidade_atual", 0),
      ]);
      if (plotData) setPlots(plotData);
      if (fuelData) setFuelItems(fuelData);
      // Auto-seleciona item de combustível compatível
      const match = fuelData?.find((f) => f.category === machine.fuel_type);
      if (match) setFuelItemId(match.id);
    }
    loadDeps();
  }, [supabase, farmId, machine.fuel_type]);

  const horasOp =
    parseFloat(horimetroFim) > parseFloat(horimetroInicio)
      ? (parseFloat(horimetroFim) - parseFloat(horimetroInicio)).toFixed(1)
      : null;

  async function handleSubmit() {
    if (!plotId || !horimetroFim) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    try {
      // 1. Registra a operação
      const { data: opData, error: opError } = await supabase
        .from("operations")
        .insert({
          farm_id: farmId,
          plot_id: plotId,
          machine_id: machine.id,
          operator_id: user?.id,
          type: opType,
          started_at: now,
          ended_at: now,
          horimetro_inicio: parseFloat(horimetroInicio),
          horimetro_fim: parseFloat(horimetroFim),
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (opError) throw opError;

      // 2. Se informou consumo de combustível: baixa do estoque
      const qty = parseFloat(fuelQty);
      if (fuelItemId && qty > 0 && opData) {
        const fuelItem = fuelItems.find((f) => f.id === fuelItemId);
        if (!fuelItem) throw new Error("Item de combustível não encontrado");

        const { error: txError } = await supabase
          .from("inventory_transactions")
          .insert({
            farm_id: farmId,
            item_id: fuelItemId,
            type: "saida",
            quantity: -qty,  // negativo = saída no ledger
            operation_id: opData.id,
            created_by: user?.id,
            notes: `Operação: ${opType} — ${machine.name} no lote ${plots.find(p => p.id === plotId)?.name}`,
          });

        if (txError) throw txError;

        // 3. Registra o insumo consumido na operação
        await supabase.from("operation_inputs").insert({
          operation_id: opData.id,
          item_id: fuelItemId,
          quantity_used: qty,
        });
      }

      // Trigger trg_machine_horimetro cuida do UPDATE em machines automaticamente
      onSubmit();
      onClose();
    } catch (err) {
      console.error("Operation error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {MACHINE_CONFIG[machine.type].emoji} {machine.name}
          </h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Lote */}
          <div className="field">
            <label className="field-label">Talhão</label>
            <div className="select-wrapper">
              <select
                value={plotId}
                onChange={(e) => setPlotId(e.target.value)}
                className="field-select"
              >
                <option value="">— Selecionar —</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {/* Tipo de operação */}
          <div className="field">
            <label className="field-label">Tipo de Operação</label>
            <div className="select-wrapper">
              <select
                value={opType}
                onChange={(e) => setOpType(e.target.value)}
                className="field-select"
              >
                {["aplicacao", "plantio", "colheita", "gradagem", "pulverizacao", "transporte", "outro"].map(
                  (t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                )}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {/* Horímetros */}
          <div className="field-row">
            <div className="field">
              <label className="field-label">Horímetro Início</label>
              <input
                type="number"
                value={horimetroInicio}
                onChange={(e) => setHorimetroInicio(e.target.value)}
                className="field-input"
                step="0.1"
              />
            </div>
            <div className="field">
              <label className="field-label">Horímetro Fim</label>
              <input
                type="number"
                value={horimetroFim}
                onChange={(e) => setHorimetroFim(e.target.value)}
                className="field-input"
                placeholder="0.0"
                autoFocus
                step="0.1"
              />
            </div>
          </div>

          {horasOp && (
            <div className="info-banner">
              ⏱ {horasOp}h de trabalho registradas
            </div>
          )}

          {/* Combustível — integração com estoque */}
          <div className="section-divider">
            <Fuel size={13} />
            Consumo de Combustível
          </div>

          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label className="field-label">Combustível</label>
              <div className="select-wrapper">
                <select
                  value={fuelItemId}
                  onChange={(e) => setFuelItemId(e.target.value)}
                  className="field-select"
                >
                  <option value="">— Nenhum —</option>
                  {fuelItems.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.quantidade_atual.toFixed(0)}{f.unit})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Qtd (L)</label>
              <input
                type="number"
                value={fuelQty}
                onChange={(e) => setFuelQty(e.target.value)}
                className="field-input"
                placeholder="0"
                step="0.5"
                min="0"
              />
            </div>
          </div>

          {fuelItemId && parseFloat(fuelQty) > 0 && (
            <div className="info-banner info-banner--warn">
              ⚠️ {parseFloat(fuelQty).toFixed(1)}L serão debitados do estoque automaticamente
            </div>
          )}

          <div className="field">
            <label className="field-label">Observações</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field-input"
              placeholder="Detalhes da operação..."
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !plotId || !horimetroFim}
          className="modal-submit"
        >
          {loading ? "Registrando..." : "Registrar Operação"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Modal: Nova / Editar Máquina (modo unificado)
// =============================================================================
function MachineModal({
  farmId,
  machine,
  onClose,
  onSaved,
}: {
  farmId: string;
  machine?: Machine;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const isEdit = !!machine;
  const [name, setName] = useState(machine?.name ?? "");
  const [type, setType] = useState<MachineType>(machine?.type ?? "trator");
  const [fuelType, setFuelType] = useState<FuelType>(machine?.fuel_type ?? "diesel");
  const [horimetro, setHorimetro] = useState(machine?.horimetro_atual.toString() ?? "0");
  const [manutencao, setManutencao] = useState(machine?.horimetro_proxima_manutencao?.toString() ?? "");
  const [placa, setPlaca] = useState(machine?.placa ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setLoading(true);

    const payload = {
      farm_id: farmId,
      name: name.trim(),
      type,
      fuel_type: fuelType,
      horimetro_atual: parseFloat(horimetro) || 0,
      horimetro_proxima_manutencao: manutencao ? parseFloat(manutencao) : null,
      placa: placa.trim() || null,
    };

    const { error } = isEdit
      ? await supabase.from("machines").update(payload).eq("id", machine!.id)
      : await supabase.from("machines").insert(payload);

    setLoading(false);
    if (!error) { onSaved(); onClose(); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? "Editar Máquina" : "Nova Máquina"}</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label">Nome</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field-input"
              placeholder="Ex: Trator MF 275"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Tipo</label>
              <div className="select-wrapper">
                <select value={type} onChange={(e) => setType(e.target.value as MachineType)} className="field-select">
                  {(Object.keys(MACHINE_CONFIG) as MachineType[]).map((t) => (
                    <option key={t} value={t}>{MACHINE_CONFIG[t].label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Combustível</label>
              <div className="select-wrapper">
                <select value={fuelType} onChange={(e) => setFuelType(e.target.value as FuelType)} className="field-select">
                  {(Object.keys(FUEL_LABELS) as FuelType[]).map((f) => (
                    <option key={f} value={f}>{FUEL_LABELS[f]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Horímetro Atual</label>
              <input
                type="number"
                value={horimetro}
                onChange={(e) => setHorimetro(e.target.value)}
                className="field-input"
                placeholder="0.0"
                step="0.1"
              />
            </div>
            <div className="field">
              <label className="field-label">Próx. Manutenção (h)</label>
              <input
                type="number"
                value={manutencao}
                onChange={(e) => setManutencao(e.target.value)}
                className="field-input"
                placeholder="0.0"
                step="50"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Placa (opcional)</label>
            <input
              value={placa}
              onChange={(e) => setPlaca(e.target.value.toUpperCase())}
              className="field-input"
              placeholder="ABC-1234"
              maxLength={8}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !name.trim()}
          className="modal-submit"
        >
          {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Adicionar Máquina"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// MachinesModule — componente principal
// =============================================================================
export function MachinesModule() {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | undefined>(undefined);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const fetchMachines = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    const { data } = await supabase
      .from("machines")
      .select("id, name, type, fuel_type, horimetro_atual, horimetro_proxima_manutencao, placa")
      .eq("farm_id", farmId)
      .order("type")
      .order("name");
    if (data) setMachines(data);
    setLoading(false);
  }, [farmId, supabase]);

  useEffect(() => { fetchMachines(); }, [fetchMachines]);

  function openNew() {
    setEditingMachine(undefined);
    setShowMachineModal(true);
  }

  function openEdit(m: Machine) {
    setEditingMachine(m);
    setShowMachineModal(true);
  }

  return (
    <div className="mach-root">
      <div className="mach-header">
        <h1 className="mach-title">Máquinas</h1>
        <button
          onClick={openNew}
          className="btn-primary"
          disabled={!farmId}
        >
          <Plus size={16} /> Nova Máquina
        </button>
      </div>

      {loading ? (
        <div className="loading">Carregando frota...</div>
      ) : machines.length === 0 ? (
        <div className="empty">
          Nenhuma máquina cadastrada. Adicione o primeiro equipamento.
        </div>
      ) : (
        <div className="machines-grid">
          {machines.map((machine) => {
            const cfg = MACHINE_CONFIG[machine.type];
            const needsMaintenance =
              machine.horimetro_proxima_manutencao !== undefined &&
              machine.horimetro_atual >= machine.horimetro_proxima_manutencao;

            return (
              <div
                key={machine.id}
                className={`machine-card ${needsMaintenance ? "machine-card--alert" : ""}`}
                style={{ "--mach-color": cfg.color } as React.CSSProperties}
              >
                <div className="machine-card-top">
                  <span className="machine-emoji">{cfg.emoji}</span>
                  <div className="machine-info">
                    <p className="machine-name">{machine.name}</p>
                    <p className="machine-meta">
                      {cfg.label}
                      {machine.placa && ` · ${machine.placa}`}
                    </p>
                  </div>
                  {needsMaintenance && (
                    <span className="maintenance-badge" title="Manutenção necessária">
                      <Wrench size={12} />
                    </span>
                  )}
                </div>

                <div className="machine-stats">
                  <div className="stat">
                    <Gauge size={13} className="stat-icon" />
                    <span className="stat-label">Horímetro</span>
                    <span className="stat-value">
                      {machine.horimetro_atual.toLocaleString("pt-BR")}h
                    </span>
                  </div>
                  <div className="stat">
                    <Fuel size={13} className="stat-icon" />
                    <span className="stat-label">Combustível</span>
                    <span className="stat-value">{FUEL_LABELS[machine.fuel_type]}</span>
                  </div>
                </div>

                <div className="machine-card-actions">
                  <button
                    className="btn-edit-machine"
                    onClick={() => openEdit(machine)}
                    title="Editar máquina"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn-operation"
                    onClick={() => setSelectedMachine(machine)}
                  >
                    Registrar Operação
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedMachine && farmId && (
        <OperationModal
          machine={selectedMachine}
          farmId={farmId}
          onClose={() => setSelectedMachine(null)}
          onSubmit={fetchMachines}
        />
      )}

      {showMachineModal && farmId && (
        <MachineModal
          farmId={farmId}
          machine={editingMachine}
          onClose={() => setShowMachineModal(false)}
          onSaved={fetchMachines}
        />
      )}

      <style>{`
        .mach-root {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }

        .mach-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .mach-title {
          font-family: var(--font-data);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }

        .machines-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 480px) {
          .machines-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .machine-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-top: 3px solid var(--mach-color);
          border-radius: var(--radius-lg);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .machine-card--alert { border-color: var(--color-warning); }

        .machine-card-top {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .machine-emoji { font-size: 24px; line-height: 1; }
        .machine-info { flex: 1; overflow: hidden; }
        .machine-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .machine-meta { font-size: 12px; color: var(--color-text-muted); }

        .maintenance-badge {
          background: rgba(250, 204, 21, 0.15);
          color: var(--color-warning);
          border: 1px solid rgba(250, 204, 21, 0.3);
          border-radius: 6px;
          padding: 4px 6px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .machine-stats {
          display: flex;
          gap: 8px;
        }
        .stat {
          flex: 1;
          background: var(--color-surface-2);
          border-radius: var(--radius);
          padding: 8px 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .stat-icon { color: var(--color-text-muted); flex-shrink: 0; }
        .stat-label { font-size: 11px; color: var(--color-text-muted); flex: 1; }
        .stat-value {
          font-family: var(--font-data);
          font-size: 13px;
          font-weight: 700;
          color: var(--color-text);
        }

        .machine-card-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .btn-edit-machine {
          background: none;
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text-muted);
          padding: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          transition: color 0.15s, border-color 0.15s;
        }
        .btn-edit-machine:hover { color: var(--color-accent-dim); border-color: var(--color-accent); }

        .btn-operation {
          flex: 1;
          background: none;
          border: 1px solid var(--mach-color);
          border-radius: var(--radius);
          color: var(--mach-color);
          font-family: var(--font-ui);
          font-size: 13px;
          font-weight: 600;
          padding: 9px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .btn-operation:hover { background: rgba(255,255,255,0.05); }

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

        /* Modal — reutiliza vars do InventoryModule, mas precisa redeclarar aqui
           pois é um componente separado */
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
        @media (min-width: 480px) {
          .modal-overlay { align-items: center; }
        }
        .modal {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          width: 100%;
          max-width: 440px;
          max-height: 90dvh;
          overflow-y: auto;
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--color-border);
          position: sticky;
          top: 0;
          background: var(--color-surface);
          z-index: 1;
        }
        .modal-title { font-family: var(--font-data); font-size: 16px; font-weight: 700; }
        .modal-close { background: none; border: none; cursor: pointer; color: var(--color-text-muted); display: flex; align-items: center; padding: 4px; }
        .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
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
          position: sticky;
          bottom: 0;
        }
        .modal-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; }
        .field-label { font-size: 12px; font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
        .field-input { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); font-family: var(--font-data); font-size: 15px; padding: 10px 12px; outline: none; width: 100%; }
        .field-input:focus { border-color: var(--color-accent); }
        .select-wrapper { position: relative; }
        .field-select { appearance: none; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius); color: var(--color-text); font-family: var(--font-ui); font-size: 14px; padding: 10px 32px 10px 12px; width: 100%; outline: none; }
        .select-icon { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }

        .section-divider {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 4px 0;
          border-top: 1px solid var(--color-border);
          margin-top: 4px;
        }

        .info-banner {
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          border-radius: var(--radius);
          padding: 8px 12px;
          font-size: 13px;
          color: var(--color-accent);
        }
        .info-banner--warn {
          background: rgba(250, 204, 21, 0.08);
          border-color: rgba(250, 204, 21, 0.25);
          color: var(--color-warning);
        }

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
