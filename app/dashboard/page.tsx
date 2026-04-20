"use client";

import { useState } from "react";
import { Package, Cpu, Leaf } from "lucide-react";
import { InventoryModule } from "@/app/components/module_inventory/InventoryModule";
import { MachinesModule } from "@/app/components/module_machinery/MachinesModule";
import { PlotsModule } from "@/app/components/module_plots/PlotsModule";

type Tab = "estoque" | "talhoes" | "maquinas";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "estoque",  label: "Estoque",  Icon: Package },
  { id: "talhoes",  label: "Talhões",  Icon: Leaf },
  { id: "maquinas", label: "Máquinas", Icon: Cpu },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("estoque");

  return (
    <div className="dashboard">
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

      <div className={activeTab === "estoque"  ? "tab-panel" : "tab-panel tab-panel--hidden"}>
        <InventoryModule />
      </div>
      <div className={activeTab === "talhoes"  ? "tab-panel" : "tab-panel tab-panel--hidden"}>
        <PlotsModule />
      </div>
      <div className={activeTab === "maquinas" ? "tab-panel" : "tab-panel tab-panel--hidden"}>
        <MachinesModule />
      </div>

      <style>{`
        .dashboard { display: flex; flex-direction: column; height: calc(100dvh - 56px); }
        .tab-panel { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
        .tab-panel--hidden { display: none; }
      `}</style>
    </div>
  );
}
