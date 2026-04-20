"use client";

import { useState, useEffect, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Bell, Wheat, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Farm { id: string; name: string; }
interface UserProfile { full_name: string; avatar_url?: string; }

export function AppHeader() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  const [farm, setFarm] = useState<Farm | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editingFarmName, setEditingFarmName] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [notifCount] = useState(2);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("users")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();
      if (profileData) setProfile(profileData);

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
    load();
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
      <Link href="/dashboard" className="agm-logo">
        <Wheat size={20} strokeWidth={2.5} />
        <span>AgroMeta</span>
      </Link>

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
          <button onClick={() => setEditingFarmName(true)} className="agm-farm-display">
            <span>{farm?.name ?? "Minha Fazenda"}</span>
            <ChevronDown size={12} className="agm-chevron" />
          </button>
        )}
      </div>

      <div className="agm-header-actions">
        <button className="agm-icon-btn agm-notif" aria-label="Notificações">
          <Bell size={20} />
          {notifCount > 0 && <span className="agm-badge">{notifCount}</span>}
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
