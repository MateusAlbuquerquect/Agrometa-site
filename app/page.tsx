'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  Plus,
  Search,
  Filter,
  Bell,
  Settings,
  Sprout,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'inventario' | 'entradas' | 'saidas'

interface ItemEstoque {
  id: number
  nome: string
  categoria: string
  quantidade: number
  unidade: string
  minimo: number
  lote: string
}

interface Movimentacao {
  id: number
  data: string
  item: string
  quantidade: number
  unidade: string
  responsavel: string
  obs: string
}

// ─── Dados mock (substituir por Supabase na Fase 2) ───────────────────────────

const ESTOQUE_INICIAL: ItemEstoque[] = [
  { id: 1, nome: 'Ureia 45%',        categoria: 'Fertilizante', quantidade: 240, unidade: 'kg',  minimo: 100, lote: 'L-2024-01' },
  { id: 2, nome: 'MAP 11-52-0',      categoria: 'Fertilizante', quantidade: 80,  unidade: 'kg',  minimo: 100, lote: 'L-2024-02' },
  { id: 3, nome: 'Glifosato 480g/L', categoria: 'Defensivo',    quantidade: 15,  unidade: 'L',   minimo: 10,  lote: 'L-2024-03' },
  { id: 4, nome: 'Óleo Diesel S10',  categoria: 'Combustível',  quantidade: 800, unidade: 'L',   minimo: 200, lote: 'L-2024-04' },
  { id: 5, nome: 'Filtro Motor JD',  categoria: 'Peça',         quantidade: 3,   unidade: 'un',  minimo: 2,   lote: 'L-2024-05' },
]

const ENTRADAS_MOCK: Movimentacao[] = [
  { id: 1, data: '18/04/2025', item: 'Ureia 45%',        quantidade: 200, unidade: 'kg', responsavel: 'Mateus',   obs: 'NF 4521' },
  { id: 2, data: '15/04/2025', item: 'Óleo Diesel S10',  quantidade: 500, unidade: 'L',  responsavel: 'Carlos',   obs: 'Abastecimento mensal' },
  { id: 3, data: '10/04/2025', item: 'MAP 11-52-0',      quantidade: 100, unidade: 'kg', responsavel: 'Mateus',   obs: 'NF 4489' },
]

const SAIDAS_MOCK: Movimentacao[] = [
  { id: 1, data: '19/04/2025', item: 'Glifosato 480g/L', quantidade: 5,   unidade: 'L',  responsavel: 'João',     obs: 'Talhão 3A' },
  { id: 2, data: '17/04/2025', item: 'Ureia 45%',        quantidade: 60,  unidade: 'kg', responsavel: 'Mateus',   obs: 'Cobertura soja' },
  { id: 3, data: '16/04/2025', item: 'Óleo Diesel S10',  quantidade: 120, unidade: 'L',  responsavel: 'Carlos',   obs: 'Trator MF 265' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusEstoque(item: ItemEstoque) {
  const ratio = item.quantidade / item.minimo
  if (ratio <= 1)   return { label: 'Crítico',  cls: 'bg-red-100 text-red-700' }
  if (ratio <= 1.5) return { label: 'Baixo',    cls: 'bg-amber-100 text-amber-700' }
  return              { label: 'OK',       cls: 'bg-lime-100 text-lime-700' }
}

function clsx(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ')
}

// ─── Sub-telas ────────────────────────────────────────────────────────────────

function Dashboard({ estoque }: { estoque: ItemEstoque[] }) {
  const criticos  = estoque.filter(i => i.quantidade <= i.minimo).length
  const baixos    = estoque.filter(i => i.quantidade > i.minimo && i.quantidade / i.minimo <= 1.5).length
  const totalItens = estoque.length

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Itens em estoque', value: totalItens,    icon: Package,       cor: 'text-lime-600' },
          { label: 'Entradas hoje',    value: 0,             icon: TrendingUp,    cor: 'text-green-600' },
          { label: 'Saídas hoje',      value: 0,             icon: TrendingDown,  cor: 'text-orange-500' },
          { label: 'Alertas críticos', value: criticos + baixos, icon: AlertTriangle, cor: 'text-red-500' },
        ].map((k) => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 font-medium">{k.label}</span>
                <Icon className={clsx('w-4 h-4', k.cor)} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            </div>
          )
        })}
      </div>

      {/* Alertas */}
      {criticos > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Estoque crítico detectado</p>
            <p className="text-sm text-red-600 mt-0.5">
              {criticos} {criticos === 1 ? 'item atingiu' : 'itens atingiram'} o limite mínimo. Verifique a aba Inventário.
            </p>
          </div>
        </div>
      )}

      {/* Tabela resumo */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Resumo do Estoque</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoria</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Qtd</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {estoque.map((item) => {
                const st = statusEstoque(item)
                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{item.nome}</td>
                    <td className="px-5 py-3 text-gray-500">{item.categoria}</td>
                    <td className="px-5 py-3 text-gray-700">{item.quantidade} {item.unidade}</td>
                    <td className="px-5 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', st.cls)}>
                        {st.label}
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
  )
}

function Inventario({ estoque, setEstoque }: {
  estoque: ItemEstoque[]
  setEstoque: React.Dispatch<React.SetStateAction<ItemEstoque[]>>
}) {
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [novoItem, setNovoItem] = useState({ nome: '', categoria: 'Fertilizante', quantidade: '', unidade: 'kg', minimo: '', lote: '' })

  const categorias = ['Todos', ...Array.from(new Set(estoque.map(i => i.categoria)))]

  const itensFiltrados = estoque.filter(item => {
    const matchBusca = item.nome.toLowerCase().includes(busca.toLowerCase())
    const matchCategoria = filtroCategoria === 'Todos' || item.categoria === filtroCategoria
    return matchBusca && matchCategoria
  })

  function registrarItem() {
    if (!novoItem.nome || !novoItem.quantidade) return
    const item: ItemEstoque = {
      id: Date.now(),
      nome: novoItem.nome,
      categoria: novoItem.categoria,
      quantidade: Number(novoItem.quantidade),
      unidade: novoItem.unidade,
      minimo: Number(novoItem.minimo) || 0,
      lote: novoItem.lote || '-',
    }
    setEstoque(prev => [...prev, item])
    setNovoItem({ nome: '', categoria: 'Fertilizante', quantidade: '', unidade: 'kg', minimo: '', lote: '' })
    setModalAberto(false)
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar item..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-800 placeholder:text-gray-400"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={filtroCategoria}
              onChange={e => setFiltroCategoria(e.target.value)}
              className="pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-700 appearance-none cursor-pointer"
            >
              {categorias.map(c => <option key={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModalAberto(true)}
          className="flex items-center gap-2 px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Novo Item
        </button>
      </div>

      {/* Tabela */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-200">
                {['Item', 'Categoria', 'Qtd', 'Mínimo', 'Lote', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itensFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">
                    Nenhum item encontrado
                  </td>
                </tr>
              ) : itensFiltrados.map((item) => {
                const st = statusEstoque(item)
                return (
                  <tr key={item.id} className="hover:bg-lime-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{item.nome}</td>
                    <td className="px-5 py-3 text-gray-500">{item.categoria}</td>
                    <td className="px-5 py-3 font-mono text-gray-700">{item.quantidade} {item.unidade}</td>
                    <td className="px-5 py-3 font-mono text-gray-500">{item.minimo} {item.unidade}</td>
                    <td className="px-5 py-3 text-gray-400 font-mono text-xs">{item.lote}</td>
                    <td className="px-5 py-3">
                      <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', st.cls)}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal novo item */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100">
            <h3 className="text-base font-semibold text-gray-900 mb-5">Registrar Novo Item</h3>
            <div className="space-y-3">
              {[
                { label: 'Nome do item', key: 'nome', type: 'text', placeholder: 'Ex: Ureia 45%' },
                { label: 'Quantidade', key: 'quantidade', type: 'number', placeholder: '0' },
                { label: 'Estoque mínimo', key: 'minimo', type: 'number', placeholder: '0' },
                { label: 'Lote / NF', key: 'lote', type: 'text', placeholder: 'L-2025-01' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={(novoItem as Record<string, string>)[field.key]}
                    onChange={e => setNovoItem(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-800 placeholder:text-gray-400"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <select
                    value={novoItem.categoria}
                    onChange={e => setNovoItem(prev => ({ ...prev, categoria: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-700"
                  >
                    {['Fertilizante', 'Defensivo', 'Combustível', 'Peça', 'Semente', 'Outro'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                  <select
                    value={novoItem.unidade}
                    onChange={e => setNovoItem(prev => ({ ...prev, unidade: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-700"
                  >
                    {['kg', 'L', 'un', 'sc', 't', 'g'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={registrarItem}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-lime-500 hover:bg-lime-600 rounded-lg transition-colors"
              >
                Registrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabelaMovimentacao({ dados, tipo }: { dados: Movimentacao[], tipo: 'entrada' | 'saida' }) {
  const [busca, setBusca] = useState('')
  const cor = tipo === 'entrada'
    ? { bg: 'bg-green-100', text: 'text-green-700', icon: ArrowDownCircle }
    : { bg: 'bg-orange-100', text: 'text-orange-700', icon: ArrowUpCircle }

  const Icon = cor.icon
  const filtrados = dados.filter(d =>
    d.item.toLowerCase().includes(busca.toLowerCase()) ||
    d.responsavel.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por item ou responsável..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-lime-400 text-gray-800 placeholder:text-gray-400"
          />
        </div>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-lime-500 hover:bg-lime-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Registrar {tipo === 'entrada' ? 'Entrada' : 'Saída'}
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-200">
                {['Data', 'Item', 'Quantidade', 'Responsável', 'Obs'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">
                    Nenhum registro encontrado
                  </td>
                </tr>
              ) : filtrados.map((mov) => (
                <tr key={mov.id} className="hover:bg-lime-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-500">{mov.data}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{mov.item}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon className={clsx('w-3.5 h-3.5', cor.text)} />
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', cor.bg, cor.text)}>
                        {mov.quantidade} {mov.unidade}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{mov.responsavel}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{mov.obs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'inventario', label: 'Inventário', icon: Package },
  { id: 'entradas',   label: 'Entradas',   icon: ArrowDownCircle },
  { id: 'saidas',     label: 'Saídas',     icon: ArrowUpCircle },
]

export default function AgroMetaApp() {
  const [abaAtiva, setAbaAtiva] = useState<Tab>('dashboard')
  const [estoque, setEstoque] = useState<ItemEstoque[]>(ESTOQUE_INICIAL)

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-lime-100 border border-lime-300 flex items-center justify-center ml-1">
            <span className="text-lime-700 text-xs font-bold">M</span>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => {
            const ativa = abaAtiva === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAbaAtiva(id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                  ativa
                    ? 'border-lime-500 text-lime-700 bg-lime-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Conteúdo */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Título da aba */}
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {TABS.find(t => t.id === abaAtiva)?.label}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {abaAtiva === 'dashboard'  && 'Visão geral do sistema'}
            {abaAtiva === 'inventario' && 'Gestão de insumos, peças e materiais'}
            {abaAtiva === 'entradas'   && 'Histórico de entradas no estoque'}
            {abaAtiva === 'saidas'     && 'Histórico de saídas do estoque'}
          </p>
        </div>

        {/* Renderiza a aba correta */}
        {abaAtiva === 'dashboard'  && <Dashboard estoque={estoque} />}
        {abaAtiva === 'inventario' && <Inventario estoque={estoque} setEstoque={setEstoque} />}
        {abaAtiva === 'entradas'   && <TabelaMovimentacao dados={ENTRADAS_MOCK} tipo="entrada" />}
        {abaAtiva === 'saidas'     && <TabelaMovimentacao dados={SAIDAS_MOCK}   tipo="saida"  />}
      </main>
    </div>
  )
}
