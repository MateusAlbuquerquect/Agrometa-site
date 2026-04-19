import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgroMeta — ERP Agrícola',
  description: 'Sistema de gestão agrícola: inventário, maquinário e operações de campo.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
