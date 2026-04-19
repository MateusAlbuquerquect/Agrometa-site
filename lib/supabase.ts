import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

// ─── Tipos sincronizados com o schema ────────────────────────────────────────

export type Profile = {
  id: string
  full_name: string
  role: 'admin' | 'operator' | 'viewer'
  avatar_url: string | null
  created_at: string
}

export type InventoryCategory =
  | 'Adubo' | 'Calcário' | 'Herbicida'
  | 'Inseticida' | 'Nutricional' | 'Diesel' | 'Gasolina' | 'Outro'

export type InventoryItem = {
  id: string
  name: string
  category: InventoryCategory
  sub_type: string | null
  quantity: number
  unit: string
  min_quantity: number
  batch_code: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Plot = {
  id: string
  name: string
  variety: string
  plant_age_months: number
  cut_cycle: number
  area_ha: number | null
  notes: string | null
  active: boolean
  created_at: string
}

export type ActivityType =
  | 'Adubação' | 'Calagem' | 'Aplicação Herbicida'
  | 'Aplicação Inseticida' | 'Nutrição Foliar' | 'Abastecimento' | 'Outro'

export type Operation = {
  id: string
  plot_id: string
  inventory_id: string
  operator_id: string | null
  operation_date: string
  quantity_used: number
  unit: string
  activity_type: ActivityType
  notes: string | null
  created_at: string
  // joins
  plots?: { name: string }
  inventory?: { name: string; category: string }
  profiles?: { full_name: string }
}

export type AlertLevel = 'empty' | 'critical' | 'low'

export type InventoryAlert = {
  id: string
  name: string
  category: string
  quantity: number
  min_quantity: number
  unit: string
  alert_level: AlertLevel
}
