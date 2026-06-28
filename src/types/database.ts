export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          tax_number: string | null
          subscription_tier: 'free' | 'basic' | 'premium'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      branches: {
        Row: {
          id: string
          tenant_id: string
          name: string
          location: string | null
          zimra_device_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      profiles: {
        Row: {
          id: string // References auth.users
          first_name: string | null
          last_name: string | null
          created_at: string
        }
      }
      tenant_users: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          branch_id: string | null
          role: 'admin' | 'manager' | 'cashier'
          created_at: string
        }
      }
      products: {
        Row: {
          id: string
          tenant_id: string
          barcode: string | null
          name: string
          description: string | null
          tax_class: 'standard' | 'zero' | 'exempt'
          base_price: number
          created_at: string
        }
      }
      inventory: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          product_id: string
          quantity: number
          low_stock_threshold: number
          updated_at: string
        }
      }
      sales: {
        Row: {
          id: string
          tenant_id: string
          branch_id: string
          user_id: string
          total_amount: number
          vat_amount: number
          zimra_receipt_signature: string | null
          status: 'completed' | 'synced' | 'offline_pending'
          created_at: string
        }
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          subtotal: number
        }
      }
    }
  }
}
