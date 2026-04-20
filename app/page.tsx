"use client";

import { useState } from "react";
import { Package, Cpu } from "lucide-react";
import { InventoryModule } from "@/components/module_inventory/InventoryModule";
import { MachinesModule } from "@/components/module_machinery/MachinesModule";

// =============================================================================
// Page — Dashboard principal com roteamento por abas
// Cada módulo é um componente independente = preparado para lazy loading
// =============================================================================

type Tab = "estoque" | "maquinas";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "estoque",  label: "Estoque",  Icon: Package },
  { id: "maquinas", label: "Máquinas", Icon: Cpu },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("estoque");

  return (
    <div className="dashboard">
      {/* Tab Bar */}
      <nav className="tab-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`tab-btn ${activeTab === id ? "tab-btn--active" : ""}`}
          >
            <Icon size={16} strokeWidth={2} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* Conteúdo — renderiza ambos mas esconde o inativo via CSS (evita re-mount) */}
      <div className={activeTab === "estoque" ? "tab-panel" : "tab-panel tab-panel--hidden"}>
        <InventoryModule />
      </div>
      <div className={activeTab === "maquinas" ? "tab-panel" : "tab-panel tab-panel--hidden"}>
        <MachinesModule />
      </div>

      <style>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 56px);
        }

        /* Tab bar sticky no topo do conteúdo */
        .tab-bar {
          display: flex;
          background: var(--color-header-bg);
          border-bottom: 1px solid var(--color-border);
          padding: 0 12px;
          gap: 4px;
          flex-shrink: 0;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--color-text-muted);
          font-family: var(--font-ui);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
          white-space: nowrap;
          margin-bottom: -1px;
        }

        .tab-btn:hover { color: var(--color-text); }

        .tab-btn--active {
          color: var(--color-accent);
          border-bottom-color: var(--color-accent);
        }

        .tab-panel {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .tab-panel--hidden {
          display: none;
        }
      `}</style>
    </div>
  );
}
