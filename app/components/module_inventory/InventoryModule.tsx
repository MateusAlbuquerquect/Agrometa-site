'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, Plus, X, TrendingDown, TrendingUp, ChevronDown } from 'lucide-react'
import type { InventoryItem, InventoryCategory } from '@/lib/supabase'

const CATEGORIES: InventoryCategory[] = [
  'Adubo','Calcário','Herbicida','Inseticida','Nutricional','Diesel','Gasolina','Outro'
]

const CAT_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  'Adubo':      { emoji: '🌱', color: '#84cc16', label: 'Adubo' },
  'Calcário':   { emoji: '🪨', color: '#a3a3a3', label: 'Calcário' },
  'Herbicida':  { emoji: '☠️', color: '#f87171', label: 'Herbicida' },
  'Inseticida': { emoji: '🐛', color: '#c084fc', label: 'Inseticida' },
  'Nutricional':{ emoji: '💧', color: '#38bdf8', label: 'Nutricional' },
  'Diesel':     { emoji: '⛽', color: '#fb923c', label: 'Diesel' },
  'Gasolina':   { emoji: '🔥', color: '#facc15', label: 'Gasolina' },
  'Outro':      { emoji: '📦', color: '#9ca3af', label: 'Outro' },
}

const LIQUIDS = ['Diesel','Gasolina','Herbicida','Nutricional']

function toBase(val: number, unit: string) { return unit === 't' ? val * 1000 : val }
function fromBase(val: number, unit: string): { n: number; u: string } {
  if (unit === 'kg' && val >= 1000) return { n: +(val / 1000).toFixed(3), u: 't' }
  return { n: val, u: unit }
}
function fmt(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

function statusItem(item: InventoryItem) {
  if (item.quantity <= 0) return 'empty'
  if (item.quantity <= item.min_quantity) return 'critical'
  if (item.quantity <= item.min_quantity * 1.5) return 'low'
  return 'ok'
}

const STATUS_CLS: Record<string, string> = {
  empty: 'bg-red-100 text-red-700',
  critical: 'bg-red-100 text-red-700',
  low: 'bg-amber-100 text-amber-700',
  ok: 'bg-lime-100 text-lime-700',
}
const STATUS_LBL: Record<string, string> = {
  empty: 'Esgotado', critical: 'Crítico', low: 'Baixo', ok: 'OK'
}

export function InventoryModule({ farmId }: { farmId: string }) {
  const [items, setItems]           = useState<InventoryItem[]>([])
  const [ops, setOps]               = useState<any[]>([])
  const [activeCategory, setActiveCat] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [subTab, setSubTab]         = useState<'estoque'|'entradas'|'saidas'>('estoque')
  const [modalItem, setModalItem]   = useState<InventoryItem | null>(null)
  const [showNew, setShowNew]       = useState(false)
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: inv }, { data: opData }] = await Promise.all([
      supabase.from('inventory').select('*').eq('farm_id', farmId).order('category').order('name'),
      supabase.from('operations').select('*, plots(name), inventory(name,category), profiles(full_name)')
        .eq('farm_id', farmId).not('inventory_id', 'is', null)
        .order('operation_date', { ascending: false }).limit(50),
    ])
    if (inv) setItems(inv as InventoryItem[])
    if (opData) setOps(opData)
    setLoading(false)
  }, [farmId])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(i => {
    const mCat = !activeCategory || i.category === activeCategory
    const mSearch = !search || i.name.toLowerCase().includes(search.toLowerCase())
    return mCat && mSearch
  })

  const countByCat = items.reduce<Record<string, number>>((a, i) => {
    a[i.category] = (a[i.category] || 0) + 1; return a
  }, {})

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px', margin: '0 auto' }}>
      {/* Sub-abas */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #e5e7eb' }}>
        {(['estoque','entradas','saidas'] as const).map(t => (
          <button key={t} onClick={() => setSubTab(t)}
            style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 500, background: 'none', border: 'none',
              borderBottom: subTab === t ? '2px solid #65a30d' : '2px solid transparent',
              color: subTab === t ? '#65a30d' : '#6b7280', cursor: 'pointer' }}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── ESTOQUE ── */}
      {subTab === 'estoque' && (
        <>
          {/* Gavetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
            {CATEGORIES.map(cat => {
              const cfg = CAT_CONFIG[cat]
              const active = activeCategory === cat
              return (
                <button key={cat} onClick={() => setActiveCat(active ? null : cat)}
                  style={{ position: 'relative', background: active ? '#f0fdf4' : '#f9fafb',
                    border: `1.5px solid ${active ? cfg.color : '#e5e7eb'}`,
                    borderRadius: '10px', padding: '10px 6px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: '4px', cursor: 'pointer', minHeight: '68px',
                    boxShadow: active ? `0 0 0 1px ${cfg.color} inset` : 'none' }}>
                  <span style={{ fontSize: '18px' }}>{cfg.emoji}</span>
                  <span style={{ fontSize: '10px', fontWeight: 500, color: active ? cfg.color : '#6b7280', textAlign: 'center' }}>
                    {cfg.label}
                  </span>
                  {(countByCat[cat] ?? 0) > 0 && (
                    <span style={{ position: 'absolute', top: '5px', right: '5px', background: '#f3f4f6',
                      color: '#6b7280', fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '8px' }}>
                      {countByCat[cat]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Busca + Botão */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar item..."
                style={{ width: '100%', padding: '8px 8px 8px 32px', fontSize: '13px', border: '1px solid #e5e7eb',
                  borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827' }} />
            </div>
            <button onClick={() => setShowNew(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#65a30d', color: 'white',
                border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Plus size={15} /> Nova Entrada
            </button>
          </div>

          {/* Lista */}
          {loading ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>Carregando...</p>
            : filtered.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '32px 0' }}>Nenhum item encontrado</p>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filtered.map(item => {
                  const cfg = CAT_CONFIG[item.category] ?? CAT_CONFIG['Outro']
                  const st = statusItem(item)
                  const { n, u } = fromBase(item.quantity, item.unit)
                  const { n: mn, u: mu } = fromBase(item.min_quantity, item.unit)
                  return (
                    <button key={item.id} onClick={() => setModalItem(item)}
                      style={{ background: '#fff', border: `1px solid #e5e7eb`, borderLeft: `3px solid ${cfg.color}`,
                        borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', gap: '12px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                          <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{cfg.emoji} {cfg.label} · {item.unit}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', fontWeight: 700, color: '#65a30d' }}>
                          {fmt(n)} <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>{u}</span>
                        </p>
                        <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '99px', display: 'inline-block', marginTop: '2px' }}
                          className={STATUS_CLS[st]}>
                          {STATUS_LBL[st]}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
        </>
      )}

      {/* ── ENTRADAS ── */}
      {subTab === 'entradas' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Data','Item','Quantidade','Lote/NF'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.batch_code).length === 0
                ? <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>Nenhuma entrada registrada</td></tr>
                : items.filter(i => i.batch_code).map(item => {
                  const { n, u } = fromBase(item.quantity, item.unit)
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111827' }}>{item.name}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '12px', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '99px' }}>
                          ↓ {fmt(n)} {u}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontFamily: 'monospace', fontSize: '12px' }}>{item.batch_code}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── SAÍDAS ── */}
      {subTab === 'saidas' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Data','Item','Qtd','Lote','Atividade'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ops.length === 0
                ? <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>Nenhuma saída. Use o Boletim.</td></tr>
                : ops.map(op => {
                  const { n, u } = fromBase(op.quantity_used ?? 0, op.unit ?? 'kg')
                  return (
                    <tr key={op.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 14px', color: '#6b7280', fontFamily: 'monospace', fontSize: '12px' }}>
                        {new Date(op.operation_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, color: '#111827' }}>{op.inventory?.name ?? '—'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#ea580c', fontSize: '12px', fontWeight: 600, background: '#ffedd5', padding: '2px 8px', borderRadius: '99px' }}>
                          ↑ {fmt(n)} {u}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280' }}>{op.plots?.name ?? '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#6b7280' }}>{op.activity_type}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Movimentação */}
      {modalItem && (
        <MovModal item={modalItem} farmId={farmId} onClose={() => setModalItem(null)} onDone={load} />
      )}

      {/* Modal Novo Item */}
      {showNew && (
        <NewItemModal farmId={farmId} onClose={() => setShowNew(false)} onDone={load} />
      )}
    </div>
  )
}

// ── Modal Movimentação ────────────────────────────────────────
function MovModal({ item, farmId, onClose, onDone }: { item: InventoryItem; farmId: string; onClose: () => void; onDone: () => void }) {
  const [type, setType]     = useState<'entrada'|'saida'>('entrada')
  const [qty, setQty]       = useState('')
  const [unit, setUnit]     = useState('kg')
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const isLiquid = ['Diesel','Gasolina','Herbicida','Nutricional'].includes(item.category)

  async function submit() {
    const q = parseFloat(qty)
    if (q <= 0) return
    setSaving(true)
    const baseQty = isLiquid ? q : (unit === 't' ? q * 1000 : q)
    if (type === 'saida') {
      // saída via update direto (sem operação de campo)
      await supabase.from('inventory').update({ quantity: item.quantity - baseQty }).eq('id', item.id)
    } else {
      await supabase.from('inventory').update({ quantity: item.quantity + baseQty, batch_code: notes || item.batch_code }).eq('id', item.id)
    }
    setSaving(false); onDone(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>{item.name}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', padding: '12px 16px 0', gap: '8px' }}>
          {(['entrada','saida'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '8px', background: '#f9fafb', border: `1.5px solid ${type === t ? (t === 'entrada' ? '#65a30d' : '#ef4444') : '#e5e7eb'}`,
                borderRadius: '8px', color: type === t ? (t === 'entrada' ? '#65a30d' : '#ef4444') : '#6b7280',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              {t === 'entrada' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
              Quantidade
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="number" autoFocus value={qty} onChange={e => setQty(e.target.value)} placeholder="0"
                style={{ flex: 1, padding: '10px 12px', fontSize: '16px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827', fontFamily: 'JetBrains Mono, monospace' }} />
              {!isLiquid && (
                <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  {['kg','t'].map(u => (
                    <button key={u} onClick={() => setUnit(u)}
                      style={{ padding: '0 14px', fontSize: '13px', fontWeight: 600, background: unit === u ? '#65a30d' : '#f9fafb', color: unit === u ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer' }}>
                      {u}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>
              NF / Observações
            </label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="NF nº, fornecedor..."
              style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827' }} />
          </div>
        </div>
        <button onClick={submit} disabled={saving || !qty}
          style={{ width: '100%', background: '#65a30d', color: '#fff', border: 'none', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: saving || !qty ? 0.5 : 1 }}>
          {saving ? 'Salvando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Novo Item ───────────────────────────────────────────
function NewItemModal({ farmId, onClose, onDone }: { farmId: string; onClose: () => void; onDone: () => void }) {
  const [name, setName]     = useState('')
  const [cat, setCat]       = useState<InventoryCategory>('Adubo')
  const [qty, setQty]       = useState('')
  const [unit, setUnit]     = useState('kg')
  const [dUnit, setDUnit]   = useState('kg')
  const [min, setMin]       = useState('')
  const [batch, setBatch]   = useState('')
  const [saving, setSaving] = useState(false)
  const isLiquid = ['Diesel','Gasolina','Herbicida','Nutricional'].includes(cat)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    const baseUnit = isLiquid ? 'L' : 'kg'
    const baseQty  = isLiquid ? (parseFloat(qty)||0) : (dUnit === 't' ? (parseFloat(qty)||0) * 1000 : (parseFloat(qty)||0))
    const baseMin  = isLiquid ? (parseFloat(min)||0) : (dUnit === 't' ? (parseFloat(min)||0) * 1000 : (parseFloat(min)||0))
    await supabase.from('inventory').insert({
      farm_id: farmId, name: name.trim(), category: cat,
      quantity: baseQty, unit: baseUnit, min_quantity: baseMin, batch_code: batch || null,
    })
    setSaving(false); onDone(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Nova Entrada de Estoque</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Categoria */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>Categoria</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {CATEGORIES.filter(c => c !== 'Outro').map(c => {
                const cfg = CAT_CONFIG[c]
                return (
                  <button key={c} onClick={() => { setCat(c); setDUnit('kg') }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                      borderRadius: '99px', border: `1.5px solid ${cat === c ? cfg.color : '#e5e7eb'}`,
                      background: cat === c ? '#f9fafb' : '#fff', color: cat === c ? cfg.color : '#6b7280', cursor: 'pointer' }}>
                    {cfg.emoji} {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Nome */}
          {[
            { label: 'Nome do item', val: name, set: setName, ph: 'Ex: Ureia 45%' },
            { label: 'Lote / NF', val: batch, set: setBatch, ph: 'NF-2025-001' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{f.label}</label>
              <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827' }} />
            </div>
          ))}
          {/* Quantidade */}
          {[
            { label: 'Quantidade', val: qty, set: setQty },
            { label: 'Estoque mínimo', val: min, set: setMin },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{f.label}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={f.val} onChange={e => f.set(e.target.value)} placeholder="0"
                  style={{ flex: 1, padding: '10px 12px', fontSize: '15px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827', fontFamily: 'JetBrains Mono, monospace' }} />
                {!isLiquid && (
                  <div style={{ display: 'flex', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    {['kg','t'].map(u => (
                      <button key={u} onClick={() => setDUnit(u)}
                        style={{ padding: '0 12px', fontSize: '12px', fontWeight: 600, background: dUnit === u ? '#65a30d' : '#f9fafb', color: dUnit === u ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer' }}>
                        {u}
                      </button>
                    ))}
                  </div>
                )}
                {isLiquid && <span style={{ padding: '10px 14px', background: '#f3f4f6', borderRadius: '8px', fontSize: '13px', color: '#6b7280', fontWeight: 600 }}>L</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '0 16px 16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 600, background: '#65a30d', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: saving || !name.trim() ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
