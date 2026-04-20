"use client";

import { useState } from "react";
import { LayoutDashboard, Package, Leaf, ClipboardList } from "lucide-react";
import { AppHeader } from "@/app/components/AppHeader";
import { DashboardModule } from "@/app/components/module_dashboard/DashboardModule";
import { InventoryModule } from "@/app/components/module_inventory/InventoryModule";
import { PlotsModule } from "@/app/components/module_plots/PlotsModule";
import { BoletimModule } from "@/app/components/module_boletim/BoletimModule";

type Tab = "dashboard" | "inventario" | "lotes" | "boletim";

const TABS: { id: Tab; label: string; Icon: React.ElementType; dot?: boolean }[] = [
  { id: "dashboard",  label: "Dashboard",  Icon: LayoutDashboard },
  { id: "inventario", label: "Inventário", Icon: Package },
  { id: "lotes",      label: "Lotes",      Icon: Leaf },
  { id: "boletim",    label: "Boletim",    Icon: ClipboardList, dot: true },
];

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <>
      <AppHeader />
      <div className="dashboard">
        <nav className="tab-bar">
          {TABS.map(({ id, label, Icon, dot }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`tab-btn ${activeTab === id ? "tab-btn--active" : ""}`}
            >
              <Icon size={15} strokeWidth={2} />
              <span>{label}</span>
              {dot && <span className="tab-dot" />}
            </button>
          ))}
        </nav>

        <div className={activeTab === "dashboard"  ? "tab-panel" : "tab-panel tab-panel--hidden"}>
          <DashboardModule />
        </div>
        <div className={activeTab === "inventario" ? "tab-panel" : "tab-panel tab-panel--hidden"}>
          <InventoryModule />
        </div>
        <div className={activeTab === "lotes"      ? "tab-panel" : "tab-panel tab-panel--hidden"}>
          <PlotsModule />
        </div>
        <div className={activeTab === "boletim"    ? "tab-panel" : "tab-panel tab-panel--hidden"}>
          <BoletimModule />
        </div>
      </div>

      <style>{`
        .dashboard {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - 56px);
        }
        .tab-panel {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
        .tab-panel--hidden { display: none; }
      `}</style>
    </>
  );
}
