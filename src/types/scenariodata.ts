export interface HouseholdFinances {
  metadata: Metadata;
  income: IncomeItem[];
  assets: AssetItem[];
  liabilities: LiabilityItem[];
  fixed_expenses: ExpenseItem[];
}

export interface Metadata {
  last_updated: string; // ISO-Format empfohlen
  currency: string;     // e.g., "EUR"
  household_name: string;
}

// --- Income ---
export type Frequency = 'monthly' | 'yearly';
export type IncomeType = 'employment' | 'government_transfer' | 'employment_bonus' | 'investment' | string;

export interface IncomeItem {
  name: string;
  amount: number;
  frequency: Frequency;
  type: IncomeType;
}

// --- Assets ---
export type AssetType = 'liquid' | 'invested';
export type AssetClass = 
  | 'checking_account' 
  | 'savings_account' 
  | 'etf' 
  | 'real_estate' 
  | 'vehicle' 
  | 'crypto' 
  | string;

export interface AssetItem {
  name: string;
  value: number;
  type: AssetType;
  asset_class: AssetClass;
}

// --- Liabilities ---
export type LiabilityType = 'mortgage' | 'loan' | 'leasing' | string;

export interface LiabilityItem {
  name: string;
  total_remaining: number;
  monthly_payment: number;
  interest_rate: number; // e.g., 3.5
  type: LiabilityType;
}

// --- Expenses ---
export type ExpenseType = 'utility' | 'insurance' | 'subscription' | 'housing' | string;

export interface ExpenseItem {
  name: string;
  amount: number;
  frequency: Frequency;
  type?: ExpenseType; // Optional, da nicht in allen Einträgen vorhanden
}