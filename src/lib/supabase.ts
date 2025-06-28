import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing');
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable URL detection to avoid conflicts
    flowType: 'pkce'
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  }
});

export type Database = {
  public: {
    Tables: {
      partners: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          current_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          current_balance?: number;
        };
        Update: {
          full_name?: string;
          current_balance?: number;
          updated_at?: string;
        };
      };
      daily_sales: {
        Row: {
          id: string;
          date: string;
          total_amount: number;
          online_amount: number;
          cash_amount: number;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          date: string;
          total_amount: number;
          online_amount: number;
          cash_amount: number;
          notes?: string | null;
          created_by: string;
        };
        Update: {
          total_amount?: number;
          online_amount?: number;
          cash_amount?: number;
          notes?: string | null;
        };
      };
      partner_transactions: {
        Row: {
          id: string;
          from_partner_id: string;
          to_partner_id: string;
          amount: number;
          description: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          from_partner_id: string;
          to_partner_id: string;
          amount: number;
          description?: string | null;
          transaction_date: string;
        };
        Update: {
          amount?: number;
          description?: string | null;
          transaction_date?: string;
        };
      };
      expense_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
        };
      };
      expenses: {
        Row: {
          id: string;
          category_id: string;
          amount: number;
          description: string;
          expense_date: string;
          receipt_url: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          category_id: string;
          amount: number;
          description: string;
          expense_date: string;
          receipt_url?: string | null;
          created_by: string;
        };
        Update: {
          category_id?: string;
          amount?: number;
          description?: string;
          expense_date?: string;
          receipt_url?: string | null;
        };
      };
    };
  };
};