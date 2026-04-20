import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnon)

export type Profile = {
  id: string
  full_name: string
  role: 'admin' | 'operator' | 'viewer'
  avatar_url: string | null
  created_at: string
}

export type Farm = {
  id: string
  name: string
  owner_id: string | null
}

export type InventoryCategory =
  | 'Adubo' | 'Calcário' | 'Herbicida'
  | 'Inseticida' | 'Nutricional' | 'Diesel' | 'Gasolina' | 'Outro'

export type InventoryItem = {
  id: string
  farm_id: string
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
  farm_id: string
  name: string
  variety: string
  cut_cycle: number
  area_ha: number
  notes: string | null
  active: boolean
  created_at: string
}

export type MachineType = 'trator' | 'colheitadeira' | 'moto' | 'caminhao' | 'pulverizador' | 'grade' | 'outro'
export type FuelType    = 'diesel' | 'gasolina' | 'flex' | 'eletrico'

export type Machine = {
  id: string
  farm_id: string
  name: string
  type: MachineType
  fuel_type: FuelType
  horimetro_atual: number
  horimetro_proxima_manutencao: number | null
  placa: string | null
  created_at: string
}

export type ActivityType =
  | 'Adubação' | 'Calagem' | 'Aplicação Herbicida'
  | 'Aplicação Inseticida' | 'Nutrição Foliar' | 'Abastecimento' | 'Outro'

export type Operation = {
  id: string
  farm_id: string
  plot_id: string
  machine_id: string | null
  inventory_id: string | null
  operator_id: string | null
  operation_date: string
  quantity_used: number | null
  unit: string | null
  activity_type: ActivityType
  horimetro_inicio: number | null
  horimetro_fim: number | null
  notes: string | null
  created_at: string
  plots?: { name: string }
  inventory?: { name: string; category: string }
  machines?: { name: string }
  profiles?: { full_name: string }
}

export type InventoryAlert = {
  id: string
  farm_id: string
  name: string
  category: string
  quantity: number
  min_quantity: number
  unit: string
  alert_level: 'empty' | 'critical' | 'low'
}
