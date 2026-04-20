"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Bell, Settings, Wheat, ChevronDown } from "lucide-react";
import Link from "next/link";

// =============================================================================
// Types
// =============================================================================
interface Farm {
  id: string;
  name: string;
}

interface UserProfile {
  full_name: string;
  avatar_url?: string;
}

// =============================================================================
// Header Component
// O farm name é carregado do Supabase e editável inline via modal de settings
// =============================================================================
export function AppHeader() {
  const supabase = createClientComponentClient();
  const [farm, setFarm] = useState<Farm | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingFarmName, setEditingFarmName] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [notifCount] = useState(2); // TODO: conectar a tabela de alertas

  useEffect(() => {
    async function loadFarmAndProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Busca perfil do usuário
      const { data: profileData } = await supabase
        .from("users")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Busca a primeira fazenda do usuário (para MVP — multi-farm vem depois)
      const { data: memberData } = await supabase
        .from("farm_members")
        .select("farms(id, name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (memberData?.farms) {
        const f = memberData.farms as unknown as Farm;
        setFarm(f);
        setNewFarmName(f.name);
      }
    }

    loadFarmAndProfile();
  }, [supabase]);

  async function saveFarmName() {
    if (!farm || !newFarmName.trim()) return;

    const { error } = await supabase
      .from("farms")
      .update({ name: newFarmName.trim(), updated_at: new Date().toISOString() })
      .eq("id", farm.id);

    if (!error) {
      setFarm({ ...farm, name: newFarmName.trim() });
      setEditingFarmName(false);
    }
  }

  return (
    <header className="agm-header">
      {/* Logo */}
      <Link href="/dashboard" className="agm-logo">
        <Wheat size={20} strokeWidth={2.5} />
        <span>AgroMeta</span>
      </Link>

      {/* Farm Name — Centro do header, editável */}
      <div className="agm-farm-name">
        {editingFarmName ? (
          <div className="agm-farm-edit">
            <input
              autoFocus
              value={newFarmName}
              onChange={(e) => setNewFarmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveFarmName();
                if (e.key === "Escape") setEditingFarmName(false);
              }}
              className="agm-farm-input"
              maxLength={50}
            />
            <button onClick={saveFarmName} className="agm-btn-save">✓</button>
            <button onClick={() => setEditingFarmName(false)} className="agm-btn-cancel">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingFarmName(true)}
            className="agm-farm-display"
            title="Clique para editar o nome da fazenda"
          >
            <span>{farm?.name ?? "..."}</span>
            <ChevronDown size={12} className="agm-chevron" />
          </button>
        )}
      </div>

      {/* Ações — Direita */}
      <div className="agm-header-actions">
        <button className="agm-icon-btn agm-notif" aria-label="Notificações">
          <Bell size={20} />
          {notifCount > 0 && (
            <span className="agm-badge">{notifCount}</span>
          )}
        </button>

        <Link href="/settings" className="agm-icon-btn agm-avatar" aria-label="Configurações">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="agm-avatar-img" />
          ) : (
            <span className="agm-avatar-initials">
              {profile?.full_name?.charAt(0).toUpperCase() ?? "M"}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

// =============================================================================
// Root Layout
// =============================================================================
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0f1a0f" />
        <title>AgroMeta</title>
        <style>{`
          /* =============================================
             DESIGN SYSTEM — AgroMeta V4
             Tema: Industrial Agrícola. Verde-terra escuro.
             Fonte: monospace para dados + sans para UI.
             ============================================= */
          :root {
            --color-bg:         #0d1a0d;
            --color-surface:    #132213;
            --color-surface-2:  #1a2e1a;
            --color-border:     #2a3e2a;
            --color-accent:     #4ade80;     /* verde neon */
            --color-accent-dim: #22c55e;
            --color-warning:    #facc15;
            --color-danger:     #f87171;
            --color-text:       #e2f5e2;
            --color-text-muted: #7da87d;
            --color-header-bg:  #0a140a;
            --font-ui:          'DM Sans', system-ui, sans-serif;
            --font-data:        'JetBrains Mono', 'Fira Code', monospace;
            --header-h:         56px;
            --radius:           8px;
            --radius-lg:        12px;
          }

          * { box-sizing: border-box; margin: 0; padding: 0; }

          html, body {
            background: var(--color-bg);
            color: var(--color-text);
            font-family: var(--font-ui);
            font-size: 15px;
            -webkit-font-smoothing: antialiased;
            min-height: 100dvh;
          }

          /* ---- HEADER ---- */
          .agm-header {
            position: sticky;
            top: 0;
            z-index: 100;
            height: var(--header-h);
            background: var(--color-header-bg);
            border-bottom: 1px solid var(--color-border);
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            padding: 0 16px;
            gap: 8px;
          }

          .agm-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            color: var(--color-accent);
            text-decoration: none;
            font-family: var(--font-data);
            font-weight: 700;
            font-size: 16px;
            letter-spacing: -0.5px;
            width: max-content;
          }

          .agm-farm-name {
            display: flex;
            justify-content: center;
          }

          .agm-farm-display {
            background: none;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--color-text-muted);
            font-family: var(--font-ui);
            font-size: 13px;
            font-weight: 500;
            letter-spacing: 0.3px;
            padding: 4px 8px;
            border-radius: var(--radius);
            transition: color 0.15s, background 0.15s;
            white-space: nowrap;
            max-width: 180px;
            overflow: hidden;
          }
          .agm-farm-display span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .agm-farm-display:hover {
            color: var(--color-text);
            background: var(--color-surface);
          }
          .agm-chevron { opacity: 0.5; flex-shrink: 0; }

          .agm-farm-edit {
            display: flex;
            align-items: center;
            gap: 4px;
          }
          .agm-farm-input {
            background: var(--color-surface);
            border: 1px solid var(--color-accent);
            border-radius: var(--radius);
            color: var(--color-text);
            font-size: 13px;
            padding: 4px 8px;
            width: 160px;
            outline: none;
          }
          .agm-btn-save, .agm-btn-cancel {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            padding: 4px 6px;
            border-radius: 4px;
          }
          .agm-btn-save { color: var(--color-accent); }
          .agm-btn-cancel { color: var(--color-danger); }

          .agm-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            justify-content: flex-end;
          }

          .agm-icon-btn {
            position: relative;
            background: none;
            border: none;
            cursor: pointer;
            color: var(--color-text-muted);
            padding: 8px;
            border-radius: var(--radius);
            display: flex;
            align-items: center;
            transition: color 0.15s, background 0.15s;
            text-decoration: none;
          }
          .agm-icon-btn:hover { color: var(--color-text); background: var(--color-surface); }

          .agm-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            background: var(--color-danger);
            color: white;
            font-size: 10px;
            font-weight: 700;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .agm-avatar {
            width: 34px;
            height: 34px;
            border-radius: 50%;
            border: 1.5px solid var(--color-border);
            overflow: hidden;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .agm-avatar-img { width: 100%; height: 100%; object-fit: cover; }
          .agm-avatar-initials {
            font-family: var(--font-data);
            font-size: 14px;
            font-weight: 700;
            color: var(--color-accent);
          }

          /* ---- LAYOUT ---- */
          .agm-main {
            min-height: calc(100dvh - var(--header-h));
            padding: 0;
          }
        `}</style>
        {/* Google Fonts — DM Sans + JetBrains Mono */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppHeader />
        <main className="agm-main">{children}</main>
      </body>
    </html>
  );
}
