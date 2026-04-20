'use client'

import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Sprout, Bell, Settings, ChevronDown, LogOut, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/supabase'

export function AppHeader() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const router = useRouter()
  const [farmName, setFarmName]       = useState('Minha Fazenda')
  const [farmId, setFarmId]           = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName]         = useState('')
  const [profile, setProfile]         = useState<Profile | null>(null)
  const [team, setTeam]               = useState<Profile[]>([])
  const [alertCount, setAlertCount]   = useState(0)
  const [profileOpen, setProfileOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const [{ data: prof }, { data: member }, { data: alerts }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', session.user.id).single(),
        supabase.from('farm_members').select('farm_id, farms(id,name)').eq('user_id', session.user.id).limit(1).single(),
        supabase.from('inventory_alerts').select('id'),
      ])

      if (prof) setProfile(prof as Profile)

      if (member?.farms) {
        const f = member.farms as unknown as { id: string; name: string }
        setFarmId(f.id); setFarmName(f.name); setNewName(f.name)

        const { data: tm } = await supabase
          .from('farm_members')
          .select('profiles(id,full_name,role)')
          .eq('farm_id', f.id)
        if (tm) setTeam(tm.map((m: any) => m.profiles).filter(Boolean) as Profile[])
      }

      if (alerts) setAlertCount(alerts.length)
    }
    load()
  }, [supabase])

  async function saveName() {
    if (!farmId || !newName.trim()) return
    await supabase.from('farms').update({ name: newName.trim() }).eq('id', farmId)
    setFarmName(newName.trim()); setEditingName(false)
  }

  async function logout() {
    await supabase.auth.signOut(); router.replace('/login')
  }

  const ROLE: Record<string, string> = { admin: 'Admin', operator: 'Operador', viewer: 'Visualizador' }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between gap-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2 text-lime-600 font-bold text-lg tracking-tight shrink-0">
        <Sprout className="w-5 h-5" />
        Agro<span className="text-gray-900">Meta</span>
      </Link>

      {/* Nome da fazenda editável */}
      <div className="flex-1 flex justify-center">
        {editingName ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveName()
                if (e.key === 'Escape') setEditingName(false)
              }}
              className="text-sm border border-lime-400 rounded-lg px-2 py-1 outline-none w-44 text-gray-800 bg-gray-50"
              maxLength={50}
            />
            <button onClick={saveName} className="text-lime-600 font-bold px-1.5">✓</button>
            <button onClick={() => setEditingName(false)} className="text-red-400 font-bold px-1">✕</button>
          </div>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded-lg max-w-[180px] truncate"
          >
            <span className="truncate">{farmName}</span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-50" />
          </button>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Sino de alertas */}
        <button
          className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title={alertCount > 0 ? `${alertCount} alertas` : 'Sem alertas'}
        >
          <Bell className="w-4 h-4" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>

        {/* Configurações */}
        <button
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          title="Configurações"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Avatar / Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(v => !v)}
            className="w-8 h-8 rounded-full bg-lime-100 border border-lime-300 flex items-center justify-center hover:bg-lime-200 ml-1"
          >
            <span className="text-lime-700 text-xs font-bold">
              {profile?.full_name?.charAt(0).toUpperCase() ?? 'M'}
            </span>
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute right-0 top-10 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                {/* User info */}
                <div className="bg-lime-50 border-b border-lime-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-lime-500 flex items-center justify-center text-white font-bold text-sm">
                      {profile?.full_name?.charAt(0).toUpperCase() ?? 'M'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{profile?.full_name ?? 'Usuário'}</p>
                      <span className="text-xs bg-lime-200 text-lime-800 px-2 py-0.5 rounded-full font-medium">
                        {ROLE[profile?.role ?? 'operator']}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Equipe */}
                <div className="px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipe</p>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {team.length === 0
                      ? <p className="text-xs text-gray-400 italic">Nenhum participante</p>
                      : team.map(m => (
                        <div key={m.id} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                            {m.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-800">{m.full_name}</p>
                            <p className="text-xs text-gray-400">{ROLE[m.role]}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 px-4 py-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <LogOut className="w-4 h-4" /> Sair do sistema
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
