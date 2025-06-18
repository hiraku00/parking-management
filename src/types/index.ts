export interface Contractor {
  id: string;
  name: string;
  parking_number: string;
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
