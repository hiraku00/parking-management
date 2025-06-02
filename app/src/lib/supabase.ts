import { createClient } from '@supabase/supabase-js';

// These will be replaced with actual values when deploying
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types based on our schema
export type Customer = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
};

export type ParkingSpot = {
  id: string;
  spot_number: number;
  is_available: boolean;
};

export type Contract = {
  id: string;
  customer_id: string;
  spot_id: string;
  start_month: string; // Format: YYYY-MM
  duration_months: number;
  created_at: string;
};

export type Payment = {
  id: string;
  contract_id: string;
  year_month: string; // Format: YYYY-MM
  status: 'paid' | 'unpaid';
  amount: number;
  paid_at?: string;
};

// Join types for UI display
export type ContractWithDetails = Contract & {
  customer: Customer;
  parking_spot: ParkingSpot;
  payments?: Payment[];
};
