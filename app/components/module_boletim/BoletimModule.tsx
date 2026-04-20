"use client";

import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { AlertTriangle, ChevronDown, Fuel, Check } from "lucide-react";

// =============================================================================
// Types
// =============================================================================
type ActivityType =
  | "Adubação"
  | "Calagem"
  | "Aplicação Herbicida"
  | "Aplicação Inseticida"
  | "Nutrição Foliar"
  | "Abastecimento"
  | "Outro";

interface Plot {
  id: string;
  name: string;
  area_ha: number | null;
}

interface Machine {
  id: string;
  name: string;
  type: string;
  fuel_type: string;
  horimetro_atual: number;
}

interface InvItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantidade_atual: number;
  avg_price_per_unit: number;
}

const ACTIVITY_TYPES: ActivityType[] = [
  "Adubação",
  "Calagem",
  "Aplicação Herbicida",
  "Aplicação Inseticida",
  "Nutrição Foliar",
  "Abastecimento",
  "Outro",
];

const ACTIVITY_ICONS: Record<ActivityType, string> = {
  Adubação: "🌱",
  Calagem: "🪨",
  "Aplicação Herbicida": "☠️",
  "Aplicação Inseticida": "🐛",
  "Nutrição Foliar": "💧",
  Abastecimento: "⛽",
  Outro: "📋",
};

const MACHINE_EMOJI: Record<string, string> = {
  trator: "🚜",
  colheitadeira: "🌾",
  moto: "🏍️",
  caminhao: "🚛",
  pulverizador: "💨",
  grade: "⚙️",
  outro: "🔧",
};

// =============================================================================
// BoletimModule — componente principal
// =============================================================================
export function BoletimModule() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [farmId, setFarmId] = useState<string | null>(null);

  // Form state
  const [opDate, setOpDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [plotId, setPlotId] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("Adubação");
  const [machineId, setMachineId] = useState("");
  const [horimetroInicio, setHorimetroInicio] = useState("");
  const [horimetroFim, setHorimetroFim] = useState("");
  const [insumoId, setInsumoId] = useState("");
  const [insumoQty, setInsumoQty] = useState("");
  const [fuelItemId, setFuelItemId] = useState("");
  const [fuelQty, setFuelQty] = useState("");
  const [notes, setNotes] = useState("");

  // Data
  const [plots, setPlots] = useState<Plot[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [insumos, setInsumos] = useState<InvItem[]>([]);
  const [fuelItems, setFuelItems] = useState<InvItem[]>([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Load farm + base data
  useEffect(() => {
    async function loadFarm() {
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

      if (member) setFarmId(member.farm_id);
    }
    loadFarm();
  }, [supabase]);

  useEffect(() => {
    if (!farmId) return;
    async function loadData() {
      const [{ data: plotData }, { data: machData }, { data: invData }] =
        await Promise.all([
          supabase
            .from("plots")
            .select("id, name, area_ha")
            .eq("farm_id", farmId!)
            .eq("active", true)
            .order("name"),
          supabase
            .from("machines")
            .select("id, name, type, fuel_type, horimetro_atual")
            .eq("farm_id", farmId!)
            .order("name"),
          supabase
            .from("inventory_items")
            .select("id, name, category, unit, quantidade_atual, avg_price_per_unit")
            .eq("farm_id", farmId!)
            .gt("quantidade_atual", 0)
            .order("category")
            .order("name"),
        ]);

      if (plotData) setPlots(plotData);
      if (machData) setMachines(machData);
      if (invData) {
        setInsumos(invData.filter((i) => !["diesel", "gasolina"].includes(i.category)));
        setFuelItems(invData.filter((i) => ["diesel", "gasolina"].includes(i.category)));
      }
    }
    loadData();
  }, [farmId, supabase]);

  // Auto-fill horímetro when machine changes
  useEffect(() => {
    const mach = machines.find((m) => m.id === machineId);
    if (mach) {
      setHorimetroInicio(mach.horimetro_atual.toString());
      setHorimetroFim("");
      // Auto-select fuel matching machine fuel type
      const match = fuelItems.find((f) => f.category === mach.fuel_type);
      if (match) setFuelItemId(match.id);
    } else {
      setHorimetroInicio("");
      setHorimetroFim("");
      setFuelItemId("");
    }
  }, [machineId, machines, fuelItems]);

  const selectedMachine = machines.find((m) => m.id === machineId);
  const selectedInsumo = insumos.find((i) => i.id === insumoId);
  const selectedFuel = fuelItems.find((f) => f.id === fuelItemId);

  const horasOp =
    horimetroFim && horimetroInicio &&
    parseFloat(horimetroFim) > parseFloat(horimetroInicio)
      ? (parseFloat(horimetroFim) - parseFloat(horimetroInicio)).toFixed(1)
      : null;

  const custoPrevisto =
    selectedInsumo && parseFloat(insumoQty) > 0 && selectedInsumo.avg_price_per_unit > 0
      ? selectedInsumo.avg_price_per_unit * parseFloat(insumoQty)
      : null;

  async function handleSubmit() {
    if (!plotId || !farmId) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    try {
      const insumoQtyNum = parseFloat(insumoQty) || 0;
      const fuelQtyNum = parseFloat(fuelQty) || 0;

      // 1. Insere operação
      const { data: opData, error: opErr } = await supabase
        .from("operations")
        .insert({
          farm_id: farmId,
          plot_id: plotId,
          machine_id: machineId || null,
          operator_id: user?.id ?? null,
          operation_date: opDate,
          activity_type: activityType,
          type: activityType.toLowerCase().replace(/\s+/g, "_"),
          quantity_used: insumoQtyNum > 0 ? insumoQtyNum : null,
          unit: selectedInsumo?.unit ?? null,
          custo_operacao: custoPrevisto ?? null,
          horimetro_inicio: horimetroInicio ? parseFloat(horimetroInicio) : null,
          horimetro_fim: horimetroFim ? parseFloat(horimetroFim) : null,
          started_at: new Date().toISOString(),
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (opErr) throw opErr;
      const opId = opData.id;

      // 2. Baixa insumo principal do estoque
      if (insumoId && insumoQtyNum > 0) {
        const { error: txErr } = await supabase
          .from("inventory_transactions")
          .insert({
            farm_id: farmId,
            item_id: insumoId,
            type: "saida",
            quantity: -insumoQtyNum,
            custo_unitario: selectedInsumo?.avg_price_per_unit ?? null,
            operation_id: opId,
            created_by: user?.id ?? null,
            notes: `Boletim: ${activityType} — ${plots.find((p) => p.id === plotId)?.name}`,
          });
        if (txErr) throw txErr;

        await supabase.from("operation_inputs").insert({
          operation_id: opId,
          item_id: insumoId,
          quantity_used: insumoQtyNum,
          custo_unitario: selectedInsumo?.avg_price_per_unit ?? null,
        });
      }

      // 3. Baixa combustível do estoque (se informado)
      if (fuelItemId && fuelQtyNum > 0) {
        const { error: fuelErr } = await supabase
          .from("inventory_transactions")
          .insert({
            farm_id: farmId,
            item_id: fuelItemId,
            type: "saida",
            quantity: -fuelQtyNum,
            custo_unitario: selectedFuel?.avg_price_per_unit ?? null,
            operation_id: opId,
            created_by: user?.id ?? null,
            notes: `Combustível: ${selectedMachine?.name ?? "Máquina"} — ${activityType}`,
          });
        if (fuelErr) throw fuelErr;
      }

      // Trigger trg_machine_horimetro atualiza horimetro automaticamente

      // Reset form
      setPlotId("");
      setActivityType("Adubação");
      setMachineId("");
      setHorimetroInicio("");
      setHorimetroFim("");
      setInsumoId("");
      setInsumoQty("");
      setFuelItemId("");
      setFuelQty("");
      setNotes("");
      setOpDate(new Date().toISOString().split("T")[0]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Boletim error:", err);
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = !!plotId && !loading;

  return (
    <div className="bol-root">
      <div className="bol-page-header">
        <h1 className="bol-page-title">Boletim</h1>
        <p className="bol-page-sub">Registrar operação de campo com baixa automática de estoque</p>
      </div>

      {/* Aviso */}
      <div className="bol-warning">
        <AlertTriangle size={16} className="bol-warning-icon" />
        <p>
          Ao registrar um boletim, o estoque do insumo selecionado é{" "}
          <strong>subtraído automaticamente</strong> e a operação é gravada no histórico
          do lote. Esta ação não pode ser desfeita.
        </p>
      </div>

      {/* Feedback de sucesso */}
      {success && (
        <div className="bol-success">
          <Check size={16} />
          Boletim registrado com sucesso!
        </div>
      )}

      {/* Formulário */}
      <div className="bol-card">
        <h2 className="bol-card-title">Boletim de Operação de Campo</h2>

        <div className="bol-form">
          {/* Data */}
          <div className="field">
            <label className="field-label">Data da operação</label>
            <input
              type="date"
              value={opDate}
              onChange={(e) => setOpDate(e.target.value)}
              className="field-input"
            />
          </div>

          {/* Lote */}
          <div className="field">
            <label className="field-label">Lote / Talhão</label>
            <div className="select-wrapper">
              <select
                value={plotId}
                onChange={(e) => setPlotId(e.target.value)}
                className="field-select"
              >
                <option value="">Selecione o lote...</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.area_ha ? ` (${p.area_ha}ha)` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {/* Tipo de atividade */}
          <div className="field">
            <label className="field-label">Tipo de atividade</label>
            <div className="select-wrapper">
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as ActivityType)}
                className="field-select"
              >
                {ACTIVITY_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {ACTIVITY_ICONS[a]} {a}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {/* Máquina (opcional) */}
          <div className="section-divider">🚜 Máquina (opcional)</div>

          <div className="field">
            <label className="field-label">Equipamento</label>
            <div className="select-wrapper">
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="field-select"
              >
                <option value="">— Sem máquina —</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {MACHINE_EMOJI[m.type] ?? "🔧"} {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {machineId && (
            <>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Horímetro Início</label>
                  <input
                    type="number"
                    value={horimetroInicio}
                    onChange={(e) => setHorimetroInicio(e.target.value)}
                    className="field-input"
                    step="0.1"
                    placeholder="0.0"
                  />
                </div>
                <div className="field">
                  <label className="field-label">Horímetro Fim</label>
                  <input
                    type="number"
                    value={horimetroFim}
                    onChange={(e) => setHorimetroFim(e.target.value)}
                    className="field-input"
                    step="0.1"
                    placeholder="0.0"
                  />
                </div>
              </div>
              {horasOp && (
                <div className="info-banner">⏱ {horasOp}h de trabalho</div>
              )}

              {/* Combustível */}
              <div className="section-divider">
                <Fuel size={13} /> Combustível (opcional)
              </div>
              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label className="field-label">Item de combustível</label>
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
                    min="0"
                    step="0.5"
                    placeholder="0"
                  />
                </div>
              </div>
              {fuelItemId && parseFloat(fuelQty) > 0 && (
                <div className="info-banner info-banner--warn">
                  ⚠️ {parseFloat(fuelQty).toFixed(1)}L de {selectedFuel?.name} serão debitados
                </div>
              )}
            </>
          )}

          {/* Insumo principal */}
          <div className="section-divider">📦 Insumo aplicado (opcional)</div>
          <div className="field-row">
            <div className="field" style={{ flex: 2 }}>
              <label className="field-label">Insumo</label>
              <div className="select-wrapper">
                <select
                  value={insumoId}
                  onChange={(e) => setInsumoId(e.target.value)}
                  className="field-select"
                >
                  <option value="">— Nenhum —</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.quantidade_atual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}{i.unit})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="select-icon" />
              </div>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field-label">Qtd</label>
              <input
                type="number"
                value={insumoQty}
                onChange={(e) => setInsumoQty(e.target.value)}
                className="field-input"
                min="0"
                step="0.001"
                placeholder="0"
              />
            </div>
          </div>

          {custoPrevisto !== null && (
            <div className="cost-preview">
              <span className="cost-label">Custo estimado da operação:</span>
              <span className="cost-value">
                R$ {custoPrevisto.toFixed(2)}
              </span>
            </div>
          )}

          {insumoId && parseFloat(insumoQty) > 0 && (
            <div className="info-banner info-banner--warn">
              ⚠️ {parseFloat(insumoQty).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}{selectedInsumo?.unit} de{" "}
              {selectedInsumo?.name} serão debitados do estoque
            </div>
          )}

          {/* Observações */}
          <div className="field">
            <label className="field-label">Observações (opcional)</label>
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
          disabled={!canSubmit}
          className="bol-submit"
        >
          {loading ? "Registrando..." : "Registrar Boletim"}
        </button>
      </div>

      <style>{`
        .bol-root {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }

        .bol-page-header { display: flex; flex-direction: column; gap: 2px; }
        .bol-page-title {
          font-family: var(--font-data);
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text);
          letter-spacing: -0.5px;
        }
        .bol-page-sub { font-size: 13px; color: var(--color-text-muted); }

        .bol-warning {
          display: flex;
          gap: 10px;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.3);
          border-radius: var(--radius);
          padding: 12px 14px;
          font-size: 13px;
          color: #92400e;
          line-height: 1.5;
        }
        .bol-warning-icon { color: #f59e0b; flex-shrink: 0; margin-top: 1px; }

        .bol-success {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(132,204,22,0.1);
          border: 1px solid rgba(132,204,22,0.3);
          border-radius: var(--radius);
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-accent-dim);
        }

        .bol-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .bol-card-title {
          font-family: var(--font-data);
          font-size: 15px;
          font-weight: 700;
          color: var(--color-text);
          padding: 16px 16px 0;
          margin-bottom: 4px;
        }

        .bol-form {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .bol-submit {
          width: 100%;
          background: var(--color-accent);
          color: #0d1a0d;
          border: none;
          padding: 16px;
          font-family: var(--font-ui);
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .bol-submit:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Shared form classes */
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
        .field-select:focus { border-color: var(--color-accent); }
        .select-icon {
          position: absolute; right: 10px; top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

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
          background: rgba(74,222,128,0.08);
          border: 1px solid rgba(74,222,128,0.2);
          border-radius: var(--radius);
          padding: 8px 12px;
          font-size: 13px;
          color: var(--color-accent-dim);
        }
        .info-banner--warn {
          background: rgba(250,204,21,0.08);
          border-color: rgba(250,204,21,0.25);
          color: #92400e;
        }

        .cost-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(74,222,128,0.08);
          border: 1px solid rgba(74,222,128,0.2);
          border-radius: var(--radius);
          padding: 8px 12px;
        }
        .cost-label { font-size: 12px; color: var(--color-text-muted); }
        .cost-value {
          font-family: var(--font-data);
          font-size: 15px;
          font-weight: 700;
          color: var(--color-accent-dim);
        }
      `}</style>
    </div>
  );
}
