import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgroMeta — ERP Agrícola',
  description: 'Gestão de inventário, lotes e operações de campo.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
