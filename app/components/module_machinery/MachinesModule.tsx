'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Gauge, Fuel, Wrench, ChevronDown, Sprout } from 'lucide-react'
import type { Machine, MachineType, FuelType, Plot, InventoryItem } from '@/lib/supabase'

const MACH_CFG: Record<MachineType, { label: string; emoji: string; color: string }> = {
  trator:        { label: 'Trator',        emoji: '🚜', color: '#fb923c' },
  colheitadeira: { label: 'Colheitadeira', emoji: '🌾', color: '#facc15' },
  moto:          { label: 'Moto',          emoji: '🏍️', color: '#a78bfa' },
  caminhao:      { label: 'Caminhão',      emoji: '🚛', color: '#60a5fa' },
  pulverizador:  { label: 'Pulverizador',  emoji: '💨', color: '#34d399' },
  grade:         { label: 'Grade',         emoji: '⚙️', color: '#9ca3af' },
  outro:         { label: 'Outro',         emoji: '🔧', color: '#6b7280' },
}

const FUEL_LBL: Record<FuelType, string> = {
  diesel: 'Diesel', gasolina: 'Gasolina', flex: 'Flex', eletrico: 'Elétrico'
}

const ACTIVITY_TYPES = ['Adubação','Calagem','Aplicação Herbicida','Aplicação Inseticida','Nutrição Foliar','Abastecimento','Outro']

export function MachinesModule({ farmId }: { farmId: string }) {
  const [machines, setMachines]     = useState<Machine[]>([])
  const [selMachine, setSelMachine] = useState<Machine | null>(null)
  const [showNew, setShowNew]       = useState(false)
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('machines').select('*').eq('farm_id', farmId).order('type').order('name')
    if (data) setMachines(data as Machine[])
    setLoading(false)
  }, [farmId])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '720px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>Máquinas</h1>
        <button onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#65a30d', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Nova Máquina
        </button>
      </div>

      {loading ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Carregando frota...</p>
        : machines.length === 0 ? <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Nenhuma máquina cadastrada.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {machines.map(m => {
              const cfg = MACH_CFG[m.type]
              const needsMaint = m.horimetro_proxima_manutencao !== null && m.horimetro_atual >= m.horimetro_proxima_manutencao
              return (
                <div key={m.id} style={{ background: '#fff', border: `1px solid ${needsMaint ? '#fbbf24' : '#e5e7eb'}`, borderTop: `3px solid ${cfg.color}`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '24px' }}>{cfg.emoji}</span>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af' }}>{cfg.label}{m.placa && ` · ${m.placa}`}</p>
                    </div>
                    {needsMaint && (
                      <span style={{ background: 'rgba(251,191,36,0.15)', color: '#d97706', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '6px', padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                        <Wrench size={12} />
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {[
                      { Icon: Gauge, label: 'Horímetro', value: `${m.horimetro_atual.toLocaleString('pt-BR')}h` },
                      { Icon: Fuel,  label: 'Combustível', value: FUEL_LBL[m.fuel_type] },
                    ].map(({ Icon, label, value }) => (
                      <div key={label} style={{ flex: 1, background: '#f9fafb', borderRadius: '8px', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon size={13} style={{ color: '#9ca3af', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: '#9ca3af', flex: 1 }}>{label}</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', fontWeight: 700, color: '#111827' }}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setSelMachine(m)}
                    style={{ width: '100%', background: 'none', border: `1px solid ${cfg.color}`, borderRadius: '8px', color: cfg.color, fontSize: '13px', fontWeight: 600, padding: '9px', cursor: 'pointer' }}>
                    Registrar Operação
                  </button>
                </div>
              )
            })}
          </div>
        )}

      {selMachine && (
        <OperationModal machine={selMachine} farmId={farmId} onClose={() => setSelMachine(null)} onDone={load} />
      )}
      {showNew && (
        <NewMachineModal farmId={farmId} onClose={() => setShowNew(false)} onDone={load} />
      )}
    </div>
  )
}

// ── Modal Operação ────────────────────────────────────────────
function OperationModal({ machine, farmId, onClose, onDone }: {
  machine: Machine; farmId: string; onClose: () => void; onDone: () => void
}) {
  const [plots, setPlots]       = useState<Plot[]>([])
  const [fuels, setFuels]       = useState<InventoryItem[]>([])
  const [plotId, setPlotId]     = useState('')
  const [opType, setOpType]     = useState('Abastecimento')
  const [hIni, setHIni]         = useState(String(machine.horimetro_atual))
  const [hFim, setHFim]         = useState('')
  const [fuelId, setFuelId]     = useState('')
  const [fuelQty, setFuelQty]   = useState('')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: pl }, { data: fu }] = await Promise.all([
        supabase.from('plots').select('id,name').eq('farm_id', farmId).eq('active', true).order('name'),
        supabase.from('inventory').select('*').eq('farm_id', farmId)
          .in('category', ['Diesel','Gasolina']).gt('quantity', 0),
      ])
      if (pl) setPlots(pl as Plot[])
      if (fu) {
        setFuels(fu as InventoryItem[])
        const match = fu.find(f => f.category.toLowerCase() === machine.fuel_type)
        if (match) setFuelId(match.id)
      }
    }
    load()
  }, [farmId, machine.fuel_type])

  const horasOp = parseFloat(hFim) > parseFloat(hIni)
    ? (parseFloat(hFim) - parseFloat(hIni)).toFixed(1) : null

  async function submit() {
    if (!plotId || !hFim) return
    setSaving(true)
    const fq = parseFloat(fuelQty) || 0
    const { error } = await supabase.from('operations').insert({
      farm_id: farmId,
      plot_id: plotId,
      machine_id: machine.id,
      activity_type: opType,
      horimetro_inicio: parseFloat(hIni),
      horimetro_fim: parseFloat(hFim),
      inventory_id: fuelId || null,
      quantity_used: fq > 0 ? fq : null,
      unit: fq > 0 ? 'L' : null,
      notes: notes || null,
      operation_date: new Date().toISOString().split('T')[0],
    })
    if (!error) { onDone(); onClose() }
    setSaving(false)
  }

  const S: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: '#fff' }}>
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>
            {MACH_CFG[machine.type].emoji} {machine.name}
          </p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Lote */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Lote</label>
            <div style={{ position: 'relative' }}>
              <select value={plotId} onChange={e => setPlotId(e.target.value)} style={{ ...S, appearance: 'none', paddingRight: '32px' }}>
                <option value="">— Selecionar —</option>
                {plots.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            </div>
          </div>
          {/* Tipo */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Tipo de Operação</label>
            <div style={{ position: 'relative' }}>
              <select value={opType} onChange={e => setOpType(e.target.value)} style={{ ...S, appearance: 'none', paddingRight: '32px' }}>
                {ACTIVITY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
            </div>
          </div>
          {/* Horímetros */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[['Horímetro Início', hIni, setHIni], ['Horímetro Fim', hFim, setHFim]].map(([lbl, val, set]) => (
              <div key={lbl as string}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{lbl as string}</label>
                <input type="number" step="0.1" value={val as string} onChange={e => (set as Function)(e.target.value)} placeholder="0.0"
                  style={{ ...S, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
            ))}
          </div>
          {horasOp && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: '#16a34a' }}>
              ⏱ {horasOp}h de trabalho registradas
            </div>
          )}
          {/* Combustível */}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Fuel size={13} /> Consumo de Combustível
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Combustível</label>
                <div style={{ position: 'relative' }}>
                  <select value={fuelId} onChange={e => setFuelId(e.target.value)} style={{ ...S, appearance: 'none', paddingRight: '32px' }}>
                    <option value="">— Nenhum —</option>
                    {fuels.map(f => <option key={f.id} value={f.id}>{f.name} ({f.quantity.toFixed(0)}L)</option>)}
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Qtd (L)</label>
                <input type="number" step="0.5" min="0" value={fuelQty} onChange={e => setFuelQty(e.target.value)} placeholder="0"
                  style={{ ...S, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
            </div>
            {fuelId && parseFloat(fuelQty) > 0 && (
              <div style={{ marginTop: '8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: '#d97706' }}>
                ⚠️ {parseFloat(fuelQty).toFixed(1)}L serão debitados do estoque
              </div>
            )}
          </div>
          {/* Obs */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Observações</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalhes..." style={S} />
          </div>
        </div>
        <button onClick={submit} disabled={saving || !plotId || !hFim}
          style={{ width: '100%', background: '#65a30d', color: '#fff', border: 'none', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: saving || !plotId || !hFim ? 0.5 : 1, position: 'sticky', bottom: 0 }}>
          {saving ? 'Registrando...' : 'Registrar Operação'}
        </button>
      </div>
    </div>
  )
}

// ── Modal Nova Máquina ────────────────────────────────────────
function NewMachineModal({ farmId, onClose, onDone }: { farmId: string; onClose: () => void; onDone: () => void }) {
  const [name, setName]         = useState('')
  const [type, setType]         = useState<MachineType>('trator')
  const [fuel, setFuel]         = useState<FuelType>('diesel')
  const [hor, setHor]           = useState('0')
  const [proxMaint, setProxMaint] = useState('')
  const [placa, setPlaca]       = useState('')
  const [saving, setSaving]     = useState(false)

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    await supabase.from('machines').insert({
      farm_id: farmId, name: name.trim(), type, fuel_type: fuel,
      horimetro_atual: parseFloat(hor) || 0,
      horimetro_proxima_manutencao: proxMaint ? parseFloat(proxMaint) : null,
      placa: placa.trim() || null,
    })
    setSaving(false); onDone(); onClose()
  }

  const S: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #e5e7eb', borderRadius: '8px', outline: 'none', background: '#f9fafb', color: '#111827' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Nova Máquina</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Nome</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Trator MF 275" style={S} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { lbl: 'Tipo', val: type, set: (v: string) => setType(v as MachineType), opts: Object.entries(MACH_CFG).map(([k,v]) => ({ value: k, label: v.label })) },
              { lbl: 'Combustível', val: fuel, set: (v: string) => setFuel(v as FuelType), opts: Object.entries(FUEL_LBL).map(([k,v]) => ({ value: k, label: v })) },
            ].map(f => (
              <div key={f.lbl}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{f.lbl}</label>
                <div style={{ position: 'relative' }}>
                  <select value={f.val} onChange={e => f.set(e.target.value)} style={{ ...S, appearance: 'none', paddingRight: '28px' }}>
                    {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={13} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { lbl: 'Horímetro Atual', val: hor, set: setHor, ph: '0.0' },
              { lbl: 'Próx. Manutenção (h)', val: proxMaint, set: setProxMaint, ph: 'Ex: 500' },
            ].map(f => (
              <div key={f.lbl}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>{f.lbl}</label>
                <input type="number" step="0.1" value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph}
                  style={{ ...S, fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '4px' }}>Placa (opcional)</label>
            <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1234" maxLength={8} style={S} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '0 16px 16px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 500, background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', color: '#374151' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            style={{ flex: 1, padding: '10px', fontSize: '14px', fontWeight: 600, background: '#65a30d', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', opacity: saving || !name.trim() ? 0.5 : 1 }}>
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  )
}
