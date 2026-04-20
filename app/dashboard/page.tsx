'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Package, Cpu, Sprout, ClipboardList, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { InventoryModule } from '@/app/components/module_inventory/InventoryModule'
import { MachinesModule }  from '@/app/components/module_machinery/MachinesModule'
import { AppHeader }       from '@/app/components/AppHeader'

type Tab = 'estoque' | 'maquinas'

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: 'estoque',  label: 'Estoque',  Icon: Package },
  { id: 'maquinas', label: 'Máquinas', Icon: Cpu },
]

export default function DashboardPage() {
  const router = useRouter()
  const [farmId, setFarmId]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState<Tab>('estoque')

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: member } = await supabase
        .from('farm_members')
        .select('farm_id')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (member?.farm_id) {
        setFarmId(member.farm_id)
      } else {
        // Sem fazenda — raro mas possível, redireciona para login
        router.replace('/login')
        return
      }
      setLoading(false)
    }
    init()
  }, [router])

  if (loading) {
    return (
      <>
        <AppHeader />
        <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
        </div>
      </>
    )
  }

  if (!farmId) return null

  return (
    <>
      <AppHeader />
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)' }}>
        {/* Tab bar */}
        <nav style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 12px', gap: '4px', flexShrink: 0 }}>
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', background: 'none', border: 'none',
                borderBottom: tab === id ? '2px solid #65a30d' : '2px solid transparent',
                color: tab === id ? '#65a30d' : '#6b7280', fontFamily: 'DM Sans, system-ui, sans-serif',
                fontSize: '14px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px' }}>
              <Icon size={16} strokeWidth={2} />
              {label}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {tab === 'estoque'  && <InventoryModule farmId={farmId} />}
          {tab === 'maquinas' && <MachinesModule  farmId={farmId} />}
        </div>
      </div>
    </>
  )
}
