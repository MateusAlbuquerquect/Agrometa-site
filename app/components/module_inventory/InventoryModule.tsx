"use client";

import { useState, useEffect, useCallback } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Search, Plus, X, ChevronDown, TrendingDown, TrendingUp } from "lucide-react";

// =============================================================================
// Types
// =============================================================================
type Category =
  | "adubo" | "calcario" | "diesel" | "gasolina"
  | "herbicida" | "inseticida" | "nutricional";

interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  unit: string;
  quantidade_atual: number;
  ultima_movimentacao: string;
}

interface TransactionPayload {
  item_id: string;
  type: "entrada" | "saida";
  quantity: number;
  valor_total_compra?: number;
  notes?: string;
}

// =============================================================================
// Config das gavetas
// Centralizar aqui: label, emoji, cor de destaque por categoria
// =============================================================================
const CATEGORY_CONFIG: Record<Category, { label: string; color: string; emoji: string }> = {
  adubo:       { label: "Adubo",      color: "#84cc16", emoji: "🌱" },
  calcario:    { label: "Calcário",   color: "#a3a3a3", emoji: "🪨" },
  diesel:      { label: "Diesel",     color: "#fb923c", emoji: "⛽" },
  gasolina:    { label: "Gasolina",   color: "#facc15", emoji: "🔥" },
  herbicida:   { label: "Herbicida",  color: "#f87171", emoji: "☠️" },
  inseticida:  { label: "Inseticida", color: "#c084fc", emoji: "🐛" },
  nutricional: { label: "Nutricional",color: "#38bdf8", emoji: "💧" },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as Category[];
const FUEL_CATEGORIES: Category[] = ["diesel", "gasolina"];

// =============================================================================
// Modal: Movimentação de Estoque
// Combustíveis exigem valor_total para rastreabilidade de custo
// =============================================================================
function TransactionModal({
  item,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSubmit: (payload: TransactionPayload) => Promise<void>;
}) {
  const isFuel = FUEL_CATEGORIES.includes(item.category);
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [quantity, setQuantity] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const quantidade = parseFloat(quantity) || 0;
  const valor = parseFloat(valorTotal) || 0;
  const custoPorUnidade = quantidade > 0 && valor > 0 ? valor / quantidade : null;

  async function handleSubmit() {
    if (quantidade <= 0) return;
    if (isFuel && type === "entrada" && valor <= 0) return;

    setLoading(true);
    try {
      await onSubmit({
        item_id: item.id,
        type,
        // Saída = negativo no ledger
        quantity: type === "saida" ? -quantidade : quantidade,
        valor_total_compra: isFuel && type === "entrada" ? valor : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{item.name}</h2>
          <button onClick={onClose} className="modal-close"><X size={18} /></button>
        </div>

        {/* Tipo de movimentação */}
        <div className="type-toggle">
          {(["entrada", "saida"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`type-btn ${type === t ? "type-btn--active" : ""}`}
              data-type={t}
            >
              {t === "entrada" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <div className="modal-body">
          <div className="field">
            <label className="field-label">Quantidade ({item.unit})</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="field-input"
              placeholder="0.000"
              autoFocus
            />
          </div>

          {/* Campos financeiros — só para entrada de combustível */}
          {isFuel && type === "entrada" && (
            <>
              <div className="field">
                <label className="field-label">Valor Total da Compra (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className="field-input"
                  placeholder="0,00"
                />
              </div>

              {custoPorUnidade && (
                <div className="cost-preview">
                  <span className="cost-label">Custo por {item.unit}:</span>
                  <span className="cost-value">
                    R$ {custoPorUnidade.toFixed(4)}
                  </span>
                </div>
              )}
            </>
          )}

          <div className="field">
            <label className="field-label">Observações (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field-input"
              placeholder="NF nº, fornecedor, etc."
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || quantidade <= 0}
          className="modal-submit"
        >
          {loading ? "Salvando..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Modal: Novo Item
// =============================================================================
function NewItemModal({
  farmId,
  defaultCategory,
  onClose,
  onCreated,
}: {
  farmId: string;
  defaultCategory?: Category;
  onClose: () => void;
  onCreated: () => void;
}) {
  const supabase = createClientComponentClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>(defaultCategory ?? "adubo");
  const [unit, setUnit] = useState("kg");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("inventory_items").insert({
      farm_id: farmId,
      name: name.trim(),
      category,
      unit,
    });
    setLoading(false);
    if (!error) { onCreated(); onClose(); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Novo Item</h2>
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
              placeholder="Ex: Ureia 45%"
            />
          </div>

          <div className="field">
            <label className="field-label">Categoria</label>
            <div className="select-wrapper">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="field-select"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Unidade</label>
            <div className="select-wrapper">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="field-select"
              >
                {["kg", "L", "sc", "t", "un"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="modal-submit"
        >
          {loading ? "Criando..." : "Criar Item"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// InventoryModule — componente principal
// =============================================================================
export function InventoryModule() {
  const supabase = createClientComponentClient();
  const [farmId, setFarmId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carrega farm_id do usuário atual
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

  const fetchItems = useCallback(async () => {
    if (!farmId) return;
    setLoading(true);
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, category, unit, quantidade_atual, ultima_movimentacao")
      .eq("farm_id", farmId)
      .order("category")
      .order("name");
    if (data) setItems(data);
    setLoading(false);
  }, [farmId, supabase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleTransaction(payload: TransactionPayload) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("inventory_transactions").insert({
      ...payload,
      farm_id: farmId,
      created_by: user?.id,
    });
    if (!error) await fetchItems();
    else console.error("Transaction error:", error);
  }

  // Filtra por gaveta ativa + busca textual
  const filteredItems = items.filter((item) => {
    const matchCategory = !activeCategory || item.category === activeCategory;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  });

  // Contagem por categoria para badge nas gavetas
  const countByCategory = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="inv-root">
      {/* Título */}
      <div className="inv-header">
        <h1 className="inv-title">Estoque</h1>
        <button
          onClick={() => setShowNewItem(true)}
          className="btn-primary"
          disabled={!farmId}
        >
          <Plus size={16} /> Novo Item
        </button>
      </div>

      {/* Gavetas de Categoria */}
      <div className="drawers-grid">
        {CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              className={`drawer ${isActive ? "drawer--active" : ""}`}
              style={{ "--drawer-color": cfg.color } as React.CSSProperties}
            >
              <span className="drawer-emoji">{cfg.emoji}</span>
              <span className="drawer-label">{cfg.label}</span>
              {countByCategory[cat] > 0 && (
                <span className="drawer-count">{countByCategory[cat]}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Campo de busca — abaixo das gavetas conforme spec */}
      <div className="search-wrapper">
        <Search size={15} className="search-icon" />
        <input
          type="text"
          placeholder="Buscar item..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        {search && (
          <button onClick={() => setSearch("")} className="search-clear">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Lista de Itens */}
      {loading ? (
        <div className="loading">Carregando...</div>
      ) : filteredItems.length === 0 ? (
        <div className="empty">
          {activeCategory
            ? `Nenhum item em ${CATEGORY_CONFIG[activeCategory].label}`
            : "Estoque vazio. Adicione o primeiro item."}
        </div>
      ) : (
        <div className="items-list">
          {filteredItems.map((item) => {
            const cfg = CATEGORY_CONFIG[item.category];
            return (
              <button
                key={item.id}
                className="item-card"
                onClick={() => setSelectedItem(item)}
                style={{ "--item-color": cfg.color } as React.CSSProperties}
              >
                <div className="item-card-left">
                  <span className="item-cat-dot" />
                  <div>
                    <p className="item-name">{item.name}</p>
                    <p className="item-meta">
                      {cfg.emoji} {cfg.label} · {item.unit}
                    </p>
                  </div>
                </div>
                <div className="item-card-right">
                  <p className="item-qty">
                    {item.quantidade_atual.toLocaleString("pt-BR", {
                      maximumFractionDigits: 2,
                    })}
                    <span className="item-unit">{item.unit}</span>
                  </p>
                  <p className="item-date">{formatDate(item.ultima_movimentacao)}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {selectedItem && (
        <TransactionModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSubmit={handleTransaction}
        />
      )}

      {showNewItem && farmId && (
        <NewItemModal
          farmId={farmId}
          defaultCategory={activeCategory ?? undefined}
          onClose={() => setShowNewItem(false)}
          onCreated={fetchItems}
        />
      )}

      <style>{`
        .inv-root {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 720px;
          margin: 0 auto;
        }

        .inv-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .inv-title {
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

        /* Gavetas */
        .drawers-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        @media (max-width: 380px) {
          .drawers-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .drawer {
          position: relative;
          background: var(--color-surface);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 12px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          min-height: 72px;
        }
        .drawer:hover {
          border-color: var(--drawer-color);
          background: var(--color-surface-2);
        }
        .drawer--active {
          border-color: var(--drawer-color);
          background: var(--color-surface-2);
          box-shadow: 0 0 0 1px var(--drawer-color) inset;
        }
        .drawer-emoji { font-size: 20px; line-height: 1; }
        .drawer-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
          text-align: center;
          line-height: 1.2;
        }
        .drawer--active .drawer-label { color: var(--drawer-color); }
        .drawer-count {
          position: absolute;
          top: 6px;
          right: 6px;
          background: var(--color-surface-2);
          color: var(--color-text-muted);
          font-family: var(--font-data);
          font-size: 10px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 10px;
          border: 1px solid var(--color-border);
        }

        /* Search */
        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 12px;
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .search-input {
          width: 100%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text);
          font-family: var(--font-ui);
          font-size: 14px;
          padding: 10px 36px 10px 36px;
          outline: none;
          transition: border-color 0.15s;
        }
        .search-input:focus { border-color: var(--color-accent); }
        .search-input::placeholder { color: var(--color-text-muted); }
        .search-clear {
          position: absolute;
          right: 10px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
        }

        /* Items list */
        .items-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .item-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-left: 3px solid var(--item-color);
          border-radius: var(--radius);
          padding: 12px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s;
          width: 100%;
        }
        .item-card:hover { background: var(--color-surface-2); }

        .item-card-left {
          display: flex;
          align-items: center;
          gap: 10px;
          overflow: hidden;
        }
        .item-cat-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--item-color);
          flex-shrink: 0;
        }
        .item-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .item-meta {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-top: 2px;
        }

        .item-card-right { text-align: right; flex-shrink: 0; }
        .item-qty {
          font-family: var(--font-data);
          font-size: 16px;
          font-weight: 700;
          color: var(--color-accent);
        }
        .item-unit {
          font-size: 11px;
          color: var(--color-text-muted);
          margin-left: 3px;
          font-weight: 400;
        }
        .item-date {
          font-family: var(--font-data);
          font-size: 10px;
          color: var(--color-text-muted);
          margin-top: 2px;
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
        @media (min-width: 480px) {
          .modal-overlay { align-items: center; }
        }

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
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          padding: 4px;
        }

        .type-toggle {
          display: flex;
          padding: 12px 16px 0;
          gap: 8px;
        }
        .type-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px;
          background: var(--color-surface-2);
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius);
          color: var(--color-text-muted);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .type-btn--active[data-type="entrada"] {
          color: var(--color-accent);
          border-color: var(--color-accent);
        }
        .type-btn--active[data-type="saida"] {
          color: var(--color-danger);
          border-color: var(--color-danger);
        }

        .modal-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .field { display: flex; flex-direction: column; gap: 4px; }
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
          font-size: 16px;
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
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .cost-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(74, 222, 128, 0.08);
          border: 1px solid rgba(74, 222, 128, 0.2);
          border-radius: var(--radius);
          padding: 8px 12px;
        }
        .cost-label { font-size: 12px; color: var(--color-text-muted); }
        .cost-value {
          font-family: var(--font-data);
          font-size: 15px;
          font-weight: 700;
          color: var(--color-accent);
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
