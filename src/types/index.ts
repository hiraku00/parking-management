export interface Contractor {
  id: string;
  name: string;
  parking_number: string;
  contract_start_year: number;
  contract_start_month: number;
  contract_end_year?: number | null;
  contract_end_month?: number | null;
  monthly_fee: number;
  created_at: string;
}

export interface Payment {
  id: string;
  contractor_id: string;
  year: number;
  month: number;
  amount: number;
  paid_at: string;
  stripe_payment_intent_id: string;
  stripe_session_id: string;
}
