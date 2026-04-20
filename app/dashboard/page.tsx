'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Package, Sprout, Bell, Settings, LogOut,
  Plus, Search, Filter, ChevronDown, X, Loader2, AlertTriangle,
  ArrowDownCircle, ArrowUpCircle, ClipboardList, TrendingDown,
  TrendingUp, Users, ChevronRight, Edit2, CheckCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Conversão de unidades ────────────────────────────────────────────────────
function toBaseUnit(value: number, displayUnit: string): number {
  return displayUnit === 't' ? value * 1000 : value
}
function fromBaseUnit(value: number, unit: string): { display: number; label: string } {
  if (unit === 'kg' && value >= 1000) return { display: +(value / 1000).toFixed(3), label: 't' }
  return { display: value, label: unit }
}

import type {
  Profile, InventoryItem, InventoryCategory,
  Plot, Operation, ActivityType, InventoryAlert,
} from '@/lib/supabase'

// ─── Utilitários ─────────────────────────────────────────────────────────────

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

const CATEGORIES: InventoryCategory[] = [
  'Adubo','Calcário','Herbicida','Inseticida','Nutricional','Diesel','Gasolina','Outro',
]

const UNITS = ['kg','L','un','sc','t','g','mL']

const ACTIVITY_TYPES: ActivityType[] = [
  'Adubação','Calagem','Aplicação Herbicida',
  'Aplicação Inseticida','Nutrição Foliar','Abastecimento','Outro',
]

const ALERT_STYLE: Record<string, string> = {
  empty:    'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  low:      'bg-amber-100 text-amber-700',
  ok:       'bg-lime-100 text-lime-700',
}

const ALERT_LABEL: Record<string, string> = {
  empty: 'Esgotado', critical: 'Crítico', low: 'Baixo', ok: 'OK',
}

function stockStatus(item: InventoryItem) {
  if (item.quantity <= 0)                         return 'empty'
  if (item.quantity <= item.min_quantity)         return 'critical'
  if (item.quantity <= item.min_quantity * 1.5)   return 'low'
  return 'ok'
}

// ─── Tipos de abas ────────────────────────────────────────────────────────────

type MainTab  = 'dashboard' | 'inventario' | 'lotes' | 'boletim'
type InvTab   = 'estoque' | 'entradas' | 'saidas'

// ─── Componente: Painel de Perfil / Equipe ────────────────────────────────────

function ProfilePanel({
  profile, team, onClose, onLogout,
}: {
  profile: Profile
  team: Profile[]
  onClose: () => void
  onLogout: () => void
}) {
  const ROLE_LABEL: Record<string, string> = {
    admin: 'Admin', operator: 'Operador', viewer: 'Visualizador',
  }
  return (
    <div className="absolute right-0 top-12 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
      {/* Cabeçalho do perfil */}
      <div className="bg-lime-50 border-b border-lime-100 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-lime-500 flex items-center justify-center text-white font-bold text-sm">
            {profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{profile.full_name}</p>
            <span className="text-xs bg-lime-200 text-lime-800 px-2 py-0.5 rounded-full font-medium">
              {ROLE_LABEL[profile.role] ?? profile.role}
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
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {team.map(member => (
            <div key={member.id} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                {member.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-800">{member.full_name}</p>
                <p className="text-xs text-gray-400">{ROLE_LABEL[member.role]}</p>
              </div>
            </div>
          ))}
          {team.length === 0 && (
            <p className="text-xs text-gray-400 italic">Nenhum participante cadastrado</p>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="border-t border-gray-100 px-4 py-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
        >
          <LogOut className="w-4 h-4" />
          Sair do sistema
        </button>
      </div>
    </div>
  )
}

// ─── Componente: Aba Inventário ────────────────────────────────────────────────

function InventoryTab({ userId }: { userId: string }) {
  const [subTab, setSubTab]       = useState<InvTab>('estoque')
  const [items, setItems]         = useState<InventoryItem[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [busca, setBusca]         = useState('')
  const [filtCat, setFiltCat]     = useState<string>('Todos')
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', category: 'Adubo' as InventoryCategory,
    sub_type: '', quantity: '', unit: 'kg',
    min_quantity: '', batch_code: '', notes: '',
  })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: inv }, { data: ops }] = await Promise.all([
      supabase.from('inventory').select('*').order('category').order('name'),
      supabase.from('operations')
        .select('*, plots(name), inventory(name,category), profiles(full_name)')
        .order('operation_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    if (inv) setItems(inv as InventoryItem[])
    if (ops) setOperations(ops as Operation[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function salvarItem() {
    if (!form.name || !form.quantity) return
    setSaving(true)
    const { error } = await supabase.from('inventory').insert({
      name:         form.name,
      category:     form.category,
      sub_type:     form.sub_type || null,
      quantity:     Number(form.quantity),
      unit:         form.unit,
      min_quantity: Number(form.min_quantity) || 0,
      batch_code:   form.batch_code || null,
      notes:        form.notes || null,
    })
    setSaving(false)
    if (error) { showToast('Erro ao salvar: ' + error.message); return }
    showToast('Item registrado com sucesso!')
    setModalOpen(false)
    setForm({ name:'', category:'Adubo', sub_type:'', quantity:'', unit:'kg', min_quantity:'', batch_code:'', notes:'' })
    loadData()
  }

  const filteredItems = items.filter(i => {
    const q  = busca.toLowerCase()
    const mB = i.name.toLowerCase().includes(q) || (i.sub_type ?? '').toLowerCase().includes(q)
    const mC = filtCat === 'Todos' || i.category === filtCat
    return mB && mC
  })

  const entradas = operations.filter(o => true)  // todas são consumos (saídas via boletim)
  const saidas   = operations  // saídas = boletim registrado

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-lime-400" />
          {toast}
        </div>
      )}

      {/* Sub-abas */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'estoque',  label: 'Estoque',  icon: Package },
          { id: 'entradas', label: 'Entradas', icon: ArrowDownCircle },
          { id: 'saidas',   label: 'Saídas',   icon: ArrowUpCircle },
        ] as { id: InvTab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors',
              subTab === id
                ? 'border-lime-500 text-lime-700'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
        </div>
      ) : (
        <>
          {/* ── SUB-ABA: ESTOQUE ── */}
          {subTab === 'estoque' && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
                <div className="flex gap-2 flex-1 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar item..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <select
                      value={filtCat}
                      onChange={e => setFiltCat(e.target.value)}
                      className="pl-8 pr-7 py-2 text-sm border border-gray-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50 appearance-none"
                    >
                      <option>Todos</option>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-lime-500 hover:bg-lime-600
                             text-white text-sm font-medium rounded-lg shadow-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> Nova Entrada
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        {['Item', 'Categoria', 'Tipo', 'Qtd Atual', 'Mínimo', 'Lote', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                            Nenhum item encontrado
                          </td>
                        </tr>
                      ) : filteredItems.map(item => {
                        const st = stockStatus(item)
                        return (
                          <tr key={item.id} className="hover:bg-lime-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-gray-500">{item.category}</td>
                            <td className="px-4 py-3 text-gray-400 text-xs">{item.sub_type ?? '—'}</td>
                            <td className="px-4 py-3 font-mono font-semibold text-gray-800">
                              {item.quantity.toLocaleString('pt-BR')} {item.unit}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-400 text-xs">
                              {item.min_quantity} {item.unit}
                            </td>
                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.batch_code ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', ALERT_STYLE[st])}>
                                {ALERT_LABEL[st]}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── SUB-ABA: ENTRADAS ── */}
          {subTab === 'entradas' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Entradas são registradas via &quot;Nova Entrada&quot; na aba Estoque.
                  Histórico de movimentações de entrada:
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Data', 'Item', 'Qtd', 'Lote/NF', 'Registrado por'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.filter(i => i.batch_code).map(item => (
                      <tr key={item.id} className="hover:bg-lime-50">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                          {new Date(item.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-green-700">
                            <ArrowDownCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold bg-green-100 px-2 py-0.5 rounded-full">
                              {item.quantity} {item.unit}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">{item.batch_code ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">Sistema</td>
                      </tr>
                    ))}
                    {items.filter(i => i.batch_code).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">
                          Nenhuma entrada registrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SUB-ABA: SAÍDAS ── */}
          {subTab === 'saidas' && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Data', 'Item', 'Qtd Usada', 'Lote', 'Atividade', 'Operador'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {saidas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-gray-400 text-sm">
                          Nenhuma saída registrada. Use o Boletim para registrar operações.
                        </td>
                      </tr>
                    ) : saidas.map(op => (
                      <tr key={op.id} className="hover:bg-lime-50">
                        <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                          {new Date(op.operation_date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {op.inventory?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-orange-600">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                            <span className="text-xs font-semibold bg-orange-100 px-2 py-0.5 rounded-full">
                              {op.quantity_used} {op.unit}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">{op.plots?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{op.activity_type}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{op.profiles?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Nova Entrada de Estoque */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Nova Entrada de Estoque</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Nome do item', key: 'name', type: 'text', placeholder: 'Ex: Ureia 45%' },
                { label: 'Tipo / Especificação', key: 'sub_type', type: 'text', placeholder: 'Ex: Granulado' },
                { label: 'Quantidade', key: 'quantity', type: 'number', placeholder: '0' },
                { label: 'Estoque mínimo', key: 'min_quantity', type: 'number', placeholder: '0' },
                { label: 'Lote / NF', key: 'batch_code', type: 'text', placeholder: 'NF-2025-001' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value as InventoryCategory }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
                  >
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
                  >
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarItem}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium
                           text-white bg-lime-500 hover:bg-lime-600 rounded-lg disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente: Aba Lotes ────────────────────────────────────────────────────

function PlotsTab() {
  const [plots, setPlots]       = useState<Plot[]>([])
  const [selected, setSelected] = useState<Plot | null>(null)
  const [history, setHistory]   = useState<Operation[]>([])
  const [loading, setLoading]   = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlot, setEditPlot]   = useState<Plot | null>(null)
  const [saving, setSaving]       = useState(false)

  function openEdit(plot: Plot) {
    setEditPlot(plot)
    setForm({
      name: plot.name,
      variety: plot.variety,
      cut_cycle: String(plot.cut_cycle),
      area_ha: String(plot.area_ha ?? ''),
      notes: plot.notes ?? '',
    })
    setModalOpen(true)
  }

  const [form, setForm] = useState({
    name: '', variety: '', 
    cut_cycle: '1', area_ha: '', notes: '',
  })

  const loadPlots = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('plots')
      .select('*')
      .eq('active', true)
      .order('name')
    if (data) setPlots(data as Plot[])
    setLoading(false)
  }, [])

  useEffect(() => { loadPlots() }, [loadPlots])

  async function selectPlot(plot: Plot) {
    setSelected(plot)
    const { data } = await supabase
      .from('operations')
      .select('*, inventory(name,category), profiles(full_name)')
      .eq('plot_id', plot.id)
      .order('operation_date', { ascending: false })
      .limit(50)
    if (data) setHistory(data as Operation[])
  }

  async function salvarLote() {
    if (!form.name) return
    setSaving(true)
    await supabase.from('plots').insert({
      name:              form.name,
      variety:           form.variety,
      
      cut_cycle:         Number(form.cut_cycle) || 1,
      area_ha:           form.area_ha ? Number(form.area_ha) : null,
      notes:             form.notes || null,
    })
    setSaving(false)
    setModalOpen(false)
    setForm({ name:'', variety:'', plant_age_months:'', cut_cycle:'1', area_ha:'', notes:'' })
    loadPlots()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div />
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-lime-500 hover:bg-lime-600
                     text-white text-sm font-medium rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo Lote
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Lista de lotes */}
          <div className="space-y-2">
            {plots.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm bg-gray-50 rounded-xl border border-gray-200">
                Nenhum lote cadastrado. Clique em &quot;Novo Lote&quot; para começar.
              </div>
            )}
            {plots.map(plot => (
              <button
                key={plot.id}
                type="button"
                onClick={() => selectPlot(plot)}
                className={cn(
                  'w-full text-left bg-white border rounded-xl p-4 hover:border-lime-300 transition-all',
                  selected?.id === plot.id
                    ? 'border-lime-500 bg-lime-50 shadow-sm'
                    : 'border-gray-200',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{plot.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{plot.variety || 'Variedade não informada'}</p>
                  </div>
                  <button type="button" onClick={e => { e.stopPropagation(); openEdit(plot) }}
                    className="p-1.5 rounded hover:bg-lime-50 text-gray-400 hover:text-lime-600 transition-colors"
                    title="Editar lote">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className={cn('w-4 h-4 mt-0.5', selected?.id === plot.id ? 'text-lime-500' : 'text-gray-300')} />
                </div>
                <div className="flex gap-3 mt-3">
                  {[
                    { label: 'Ciclo', value: `${plot.cut_cycle}° corte` },
                    { label: 'Idade', value: `${plot.plant_age_months} meses` },
                    { label: 'Área', value: plot.area_ha ? `${plot.area_ha} ha` : '—' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className="text-xs font-semibold text-gray-700">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* Histórico do lote selecionado */}
          {selected ? (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 bg-lime-50">
                <p className="text-sm font-semibold text-lime-800">
                  Histórico — {selected.name}
                </p>
                <p className="text-xs text-lime-600">{history.length} operações registradas</p>
              </div>
              <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-10">
                    Nenhuma operação registrada neste lote.
                  </p>
                ) : history.map(op => (
                  <div key={op.id} className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{op.activity_type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{op.inventory?.name}</p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                        -{op.quantity_used} {op.unit}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs text-gray-400">
                        {new Date(op.operation_date).toLocaleDateString('pt-BR')}
                      </span>
                      {op.profiles?.full_name && (
                        <span className="text-xs text-gray-400">· {op.profiles.full_name}</span>
                      )}
                      {op.notes && (
                        <span className="text-xs text-gray-400 italic">· {op.notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
              <p className="text-sm text-gray-400">Selecione um lote para ver o histórico</p>
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Lote */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">{editPlot ? 'Editar Lote' : 'Cadastrar Lote'}</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Nome do lote',     key: 'name',              type: 'text',   placeholder: 'Ex: Lote 01' },
                { label: 'Variedade da cana', key: 'variety',           type: 'text',   placeholder: 'Ex: RB92579' },
                
                { label: 'Área (ha)',         key: 'area_ha',           type: 'number', placeholder: '0.00' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    value={(form as Record<string, string>)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Ciclo de corte (1–10)
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={form.cut_cycle}
                  onChange={e => setForm(p => ({ ...p, cut_cycle: e.target.value }))}
                  className="w-full accent-lime-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>1° corte</span>
                  <span className="font-semibold text-lime-600">{form.cut_cycle}° corte</span>
                  <span>10° corte</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea
                  rows={2}
                  placeholder="Notas opcionais..."
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 px-6 pb-6">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={salvarLote}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2
                           text-sm font-medium text-white bg-lime-500 hover:bg-lime-600 rounded-lg disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editPlot ? 'Salvar alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente: Boletim Diário ───────────────────────────────────────────────

function BoletimTab({ userId }: { userId: string }) {
  const [plots, setPlots]         = useState<Plot[]>([])
  const [items, setItems]         = useState<InventoryItem[]>([])
  const [saving, setSaving]       = useState(false)
  const [success, setSuccess]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [form, setForm] = useState({
    plot_id:       '',
    inventory_id:  '',
    activity_type: 'Adubação' as ActivityType,
    quantity_used: '',
    operation_date: new Date().toISOString().split('T')[0],
    notes:         '',
  })

  const selectedItem = items.find(i => i.id === form.inventory_id)

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: inv }] = await Promise.all([
        supabase.from('plots').select('id,name').eq('active', true).order('name'),
        supabase.from('inventory').select('*').order('category').order('name'),
      ])
      if (pl)  setPlots(pl as Plot[])
      if (inv) setItems(inv as InventoryItem[])
    }
    load()
  }, [])

  async function registrarBoletim(e: React.FormEvent) {
    e.preventDefault()
    if (!form.plot_id || !form.inventory_id || !form.quantity_used) return
    setSaving(true)
    setError(null)

    const qty = Number(form.quantity_used)

    // Verifica estoque antes de tentar (feedback imediato)
    const item = items.find(i => i.id === form.inventory_id)
    if (item && item.quantity < qty) {
      setError(`Estoque insuficiente. Disponível: ${item.quantity} ${item.unit}`)
      setSaving(false)
      return
    }

    const { error: err } = await supabase.from('operations').insert({
      plot_id:        form.plot_id,
      inventory_id:   form.inventory_id,
      operator_id:    userId,
      activity_type:  form.activity_type,
      quantity_used:  qty,
      unit:           item?.unit ?? '',
      operation_date: form.operation_date,
      notes:          form.notes || null,
    })

    setSaving(false)

    if (err) {
      setError(err.message.includes('Estoque insuficiente')
        ? 'Estoque insuficiente para esta operação.'
        : 'Erro ao registrar: ' + err.message)
      return
    }

    // Atualiza estoque localmente para feedback imediato
    setItems(prev => prev.map(i =>
      i.id === form.inventory_id
        ? { ...i, quantity: i.quantity - qty }
        : i
    ))

    setSuccess(true)
    setForm(p => ({ ...p, inventory_id: '', quantity_used: '', notes: '' }))
    setTimeout(() => setSuccess(false), 4000)
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          Ao registrar um boletim, o estoque do insumo selecionado é
          <strong> subtraído automaticamente</strong> e a operação é gravada
          no histórico do lote. Esta ação não pode ser desfeita.
        </p>
      </div>

      {success && (
        <div className="bg-lime-50 border border-lime-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-lime-600" />
          <p className="text-sm text-lime-700 font-medium">
            Boletim registrado! Estoque atualizado com sucesso.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={registrarBoletim} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-800">Boletim de Operação de Campo</h3>
        </div>
        <div className="p-6 space-y-4">
          {/* Data */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Data da operação</label>
            <input
              type="date"
              required
              value={form.operation_date}
              onChange={e => setForm(p => ({ ...p, operation_date: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
            />
          </div>

          {/* Lote */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Lote / Lote</label>
            <select
              required
              value={form.plot_id}
              onChange={e => setForm(p => ({ ...p, plot_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
            >
              <option value="">Selecione o lote...</option>
              {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Tipo de atividade */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de atividade</label>
            <select
              value={form.activity_type}
              onChange={e => setForm(p => ({ ...p, activity_type: e.target.value as ActivityType }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
            >
              {ACTIVITY_TYPES.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          {/* Insumo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Insumo utilizado</label>
            <select
              required
              value={form.inventory_id}
              onChange={e => setForm(p => ({ ...p, inventory_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
            >
              <option value="">Selecione o insumo...</option>
              {CATEGORIES.map(cat => {
                const catItems = items.filter(i => i.category === cat)
                if (catItems.length === 0) return null
                return (
                  <optgroup key={cat} label={cat}>
                    {catItems.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} — {i.quantity} {i.unit} disponível
                      </option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
            {/* Preview do estoque disponível */}
            {selectedItem && (
              <div className={cn(
                'mt-1.5 text-xs px-2 py-1 rounded flex items-center gap-1.5',
                stockStatus(selectedItem) === 'ok'
                  ? 'text-lime-700 bg-lime-50'
                  : stockStatus(selectedItem) === 'empty'
                    ? 'text-red-700 bg-red-50'
                    : 'text-amber-700 bg-amber-50',
              )}>
                <span>Disponível:</span>
                <strong>{selectedItem.quantity} {selectedItem.unit}</strong>
                <span className={cn('ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold', ALERT_STYLE[stockStatus(selectedItem)])}>
                  {ALERT_LABEL[stockStatus(selectedItem)]}
                </span>
              </div>
            )}
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Quantidade utilizada {selectedItem ? `(${selectedItem.unit})` : ''}
            </label>
            <input
              type="number"
              required
              min={0.001}
              step="0.001"
              placeholder="0"
              value={form.quantity_used}
              onChange={e => setForm(p => ({ ...p, quantity_used: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50"
            />
          </div>

          {/* Obs */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações (opcional)</label>
            <textarea
              rows={2}
              placeholder="Ex: Aplicação na área norte, cobertura 2a safra..."
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-lime-400 bg-gray-50 resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6">
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5
                       bg-lime-500 hover:bg-lime-600 disabled:opacity-60
                       text-white text-sm font-semibold rounded-lg shadow-sm"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
              : <><ClipboardList className="w-4 h-4" /> Registrar Boletim</>
            }
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Componente: Dashboard ─────────────────────────────────────────────────────

function DashboardTab() {
  const [alerts, setAlerts]   = useState<InventoryAlert[]>([])
  const [ops, setOps]         = useState<Operation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: al }, { data: op }] = await Promise.all([
        supabase.from('inventory_alerts').select('*'),
        supabase.from('operations')
          .select('*, plots(name), inventory(name), profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      if (al) setAlerts(al as InventoryAlert[])
      if (op) setOps(op as Operation[])
      setLoading(false)
    }
    load()
  }, [])

  const criticals = alerts.filter(a => a.alert_level === 'critical' || a.alert_level === 'empty')

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Alertas críticos', value: criticals.length,  icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-50' },
          { label: 'Itens com alerta', value: alerts.length,     icon: Package,       color: 'text-amber-500',  bg: 'bg-amber-50' },
          { label: 'Ops. registradas', value: ops.length,        icon: ClipboardList, color: 'text-lime-600',   bg: 'bg-lime-50' },
          { label: 'Consumo recente',  value: ops.reduce((s, o) => s + o.quantity_used, 0).toFixed(1),
            icon: TrendingDown, color: 'text-blue-500', bg: 'bg-blue-50' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{k.label}</span>
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', k.bg)}>
                  <Icon className={cn('w-3.5 h-3.5', k.color)} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            </div>
          )
        })}
      </div>

      {/* Alertas críticos */}
      {criticals.length > 0 && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <p className="text-sm font-semibold text-red-700">
              {criticals.length} {criticals.length === 1 ? 'item crítico' : 'itens críticos'} no estoque
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {criticals.map(a => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-400">{a.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{a.quantity} {a.unit}</p>
                  <p className="text-xs text-gray-400">mín: {a.min_quantity} {a.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas operações */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-700">Últimas operações</p>
        </div>
        <div className="divide-y divide-gray-100">
          {ops.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              Nenhuma operação ainda. Use o Boletim para registrar.
            </p>
          ) : ops.map(op => (
            <div key={op.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{op.activity_type}</p>
                <p className="text-xs text-gray-400">
                  {op.plots?.name} · {op.inventory?.name} ·{' '}
                  {new Date(op.operation_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <span className="text-xs font-mono font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                -{op.quantity_used} {op.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── App Principal ────────────────────────────────────────────────────────────

const MAIN_TABS: { id: MainTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',  label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventario', label: 'Inventário', icon: Package },
  { id: 'lotes',      label: 'Lotes',     icon: Sprout },
  { id: 'boletim',    label: 'Boletim',   icon: ClipboardList },
]

export default function DashboardPage() {
  const router = useRouter()
  const [tab, setTab]             = useState<MainTab>('dashboard')
  const [profile, setProfile]     = useState<Profile | null>(null)
  const [team, setTeam]           = useState<Profile[]>([])
  const [alerts, setAlerts]       = useState<InventoryAlert[]>([])
  const [profileOpen, setProfileOpen] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      // Busca perfil — se tabela não existir ainda, usa fallback do auth
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (prof) {
        setProfile(prof as Profile)
      } else {
        // Fallback: monta perfil básico com dados do Auth enquanto o schema não está rodado
        setProfile({
          id:         session.user.id,
          full_name:  session.user.user_metadata?.full_name
                      ?? session.user.email?.split('@')[0]
                      ?? 'Usuário',
          role:       'admin',
          avatar_url: null,
          created_at: session.user.created_at,
        })
        if (profErr) {
          console.warn('Tabela profiles não encontrada. Rode o supabase-schema.sql no Supabase.')
        }
      }

      // Busca equipe e alertas — ignora erros silenciosamente se tabelas não existem
      const [{ data: tm }, { data: al }] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name'),
        supabase.from('inventory_alerts').select('*'),
      ])

      if (tm)  setTeam(tm as Profile[])
      if (al)  setAlerts(al as InventoryAlert[])
      setCheckingAuth(false)
    }
    init()
  }, [router])

  async function logout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const criticalCount = alerts.filter(a =>
    a.alert_level === 'critical' || a.alert_level === 'empty'
  ).length

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-lime-500" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center shadow-sm">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg tracking-tight">
            Agro<span className="text-lime-600">Meta</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sino de alertas */}
          <div className="relative">
            <button
              type="button"
              className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
              title={criticalCount > 0 ? `${criticalCount} alertas críticos` : 'Sem alertas'}
            >
              <Bell className="w-4 h-4" />
              {criticalCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                  {criticalCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Avatar / Perfil */}
          <div className="relative ml-1">
            <button
              type="button"
              onClick={() => setProfileOpen(v => !v)}
              className="w-8 h-8 rounded-full bg-lime-100 border border-lime-300 flex items-center justify-center hover:bg-lime-200 transition-colors"
            >
              <span className="text-lime-700 text-xs font-bold">
                {profile.full_name.charAt(0).toUpperCase()}
              </span>
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="relative z-50">
                  <ProfilePanel
                    profile={profile}
                    team={team}
                    onClose={() => setProfileOpen(false)}
                    onLogout={logout}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Tabs principais */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {MAIN_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                tab === id
                  ? 'border-lime-500 text-lime-700 bg-lime-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === 'boletim' && (
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 ml-0.5" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {MAIN_TABS.find(t => t.id === tab)?.label}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {tab === 'dashboard'  && 'Visão geral, alertas e últimas operações'}
            {tab === 'inventario' && 'Estoque de insumos, entradas e saídas'}
            {tab === 'lotes'      && 'Talhões, variedades e histórico de operações'}
            {tab === 'boletim'    && 'Registrar operação de campo com baixa automática de estoque'}
          </p>
        </div>

        {tab === 'dashboard'  && <DashboardTab />}
        {tab === 'inventario' && <InventoryTab userId={profile.id} />}
        {tab === 'lotes'      && <PlotsTab />}
        {tab === 'boletim'    && <BoletimTab userId={profile.id} />}
      </main>
    </div>
  )
}
