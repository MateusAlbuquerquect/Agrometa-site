export default function Home() {
  return (
    <main className="min-h-screen bg-agro-dark flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="flex items-center gap-3 justify-center">
          <div className="w-10 h-10 bg-agro-green rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Agro<span className="text-agro-green">Meta</span>
          </h1>
        </div>
        <p className="text-gray-400 text-lg">
          ERP Agrícola — Sistema de Gestão Inteligente
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
          {[
            { label: 'Inventário', desc: 'Insumos e Peças', status: 'Em breve' },
            { label: 'Maquinário', desc: 'Horas e Manutenção', status: 'Em breve' },
            { label: 'Campo', desc: 'Atividades e Safra', status: 'Em breve' },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-white/5 border border-white/10 rounded-xl p-4 text-left"
            >
              <p className="text-white font-medium text-sm">{m.label}</p>
              <p className="text-gray-500 text-xs mt-1">{m.desc}</p>
              <span className="inline-block mt-3 text-xs bg-agro-green/10 text-agro-green px-2 py-0.5 rounded-full">
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
