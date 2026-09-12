-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables (for development - be careful in production!)
drop table if exists public.payments cascade;
drop table if exists public.profiles cascade;

-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id), -- Nullable, only for Owner
  full_name text unique not null,
  role text not null check (role in ('owner', 'contractor')),
  monthly_fee integer default 3000, -- Default monthly fee
  phone_number text, -- Full phone number (e.g., 090-1234-5678)
  phone_last4 text, -- Last 4 digits for authentication
  contract_start_month text, -- Format: YYYY-MM, for contractors only
  contract_end_month text, -- Format: YYYY-MM, NULL means indefinite contract
  company_name text, -- Owner's company name or trade name
  address text, -- Owner's address for receipts
  invoice_registration_number text, -- Owner's Invoice Registration Number (e.g. T1234567890123)
  bank_name text, -- Owner's Bank Name
  bank_branch_name text, -- Owner's Bank Branch Name
  account_type text, -- 'ordinary' (futsu) or 'current' (toza)
  account_number text, -- Account Number
  account_holder_name text, -- Account Holder Name
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) not null,
  amount integer not null,
  currency text default 'jpy',
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  target_month text not null, -- Format: YYYY-MM
  stripe_session_id text,
  payment_method text check (payment_method in ('stripe', 'cash', 'bank_transfer')), -- 'stripe', 'cash', 'bank_transfer'
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.payments enable row level security;

-- Create a secure function to check if the user is an owner
-- SECURITY DEFINER means this function runs with the privileges of the creator (postgres/admin),
-- bypassing RLS on the table it queries, thus avoiding infinite recursion.
create or replace function public.is_owner()
returns boolean as $$
begin
  return exists (
    select 1
    from public.profiles
    where auth_id = auth.uid()
    and role = 'owner'
  );
end;
$$ language plpgsql security definer;

-- RLS Policies

-- Policy for Owner to read/write all profiles
create policy "Owner can manage all profiles"
  on public.profiles
  for all
  using ( public.is_owner() );

-- Policy for Owner to read/write all payments
create policy "Owner can manage all payments"
  on public.payments
  for all
  using ( public.is_owner() );

-- Note: Contractors access will be handled via Server Actions using Service Role,
-- as they don't have Supabase Auth accounts.
