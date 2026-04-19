import { Package, Tractor, Sprout, BarChart3, Settings, Bell } from 'lucide-react'

const modules = [
  {
    icon: Package,
    label: 'Inventário',
    desc: 'Insumos e peças',
    status: 'fase 1',
    active: false,
  },
  {
    icon: Tractor,
    label: 'Maquinário',
    desc: 'Horas e manutenção',
    status: 'fase 2',
    active: false,
  },
  {
    icon: Sprout,
    label: 'Campo',
    desc: 'Atividades e safra',
    status: 'fase 3',
    active: false,
  },
  {
    icon: BarChart3,
    label: 'Financeiro',
    desc: 'Custos e receitas',
    status: 'fase 4',
    active: false,
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      {/* Header */}
      <header className="border-b border-[#1e2e22] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
            <Sprout className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">
            Agro<span className="text-green-500">Meta</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <span className="text-green-400 text-xs font-medium">M</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="px-6 py-10 max-w-4xl mx-auto">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-1">
            Bem-vindo ao AgroMeta
          </h1>
          <p className="text-gray-400 text-sm">
            Selecione um módulo para começar. Novos módulos serão liberados por fase.
          </p>
        </div>

        {/* Status geral */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Fazendas', value: '0' },
            { label: 'Insumos', value: '0' },
            { label: 'Máquinas', value: '0' },
            { label: 'Alertas', value: '0' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#111a14] border border-[#1e2e22] rounded-xl p-4"
            >
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Módulos */}
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-4">
          Módulos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {modules.map((mod) => {
            const Icon = mod.icon
            return (
              <div
                key={mod.label}
                className="bg-[#111a14] border border-[#1e2e22] rounded-xl p-5 flex items-start gap-4 opacity-60 cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-white font-medium text-sm">{mod.label}</p>
                    <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {mod.status}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">{mod.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
