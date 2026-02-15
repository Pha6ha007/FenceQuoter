// types/database.ts
// Database table types aligned with CLAUDE.md section 5 and 001_initial.sql

import type {
  CustomItem,
  FenceType,
  QuoteInputs,
  QuoteStatus,
  QuoteVariant,
  RegionCode,
  UnitSystem,
  VariantType,
} from "./quote";

export interface Profile {
  id: string; // uuid, references auth.users(id)
  company_name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  region: RegionCode;
  currency: string; // USD, CAD, GBP, EUR, AUD
  unit_system: UnitSystem;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface Settings {
  user_id: string; // uuid, references auth.users(id)
  hourly_rate: number;
  default_markup_percent: number; // integer, e.g. 20 = 20%
  tax_percent: number; // integer, e.g. 8 = 8%
  terms_template: string;
  updated_at: string; // ISO timestamp
}

export interface Material {
  id: string; // uuid
  user_id: string; // uuid, references auth.users(id)
  fence_type: FenceType;
  name: string;
  unit: string;
  unit_price: number;
  category: string; // post | rail | panel | concrete | hardware | gate
  sort_order: number;
  is_active: boolean;
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface Quote {
  id: string; // uuid
  user_id: string; // uuid, references auth.users(id)

  // Client info
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;

  // Status
  status: QuoteStatus;

  // Raw inputs (what user entered in the form)
  inputs: QuoteInputs;

  // Calculated variants (array of 3: budget/standard/premium)
  variants: QuoteVariant[];

  // Which variant user selected for PDF
  selected_variant: VariantType;

  // Custom line items added by user
  custom_items: CustomItem[];

  // Denormalized totals of selected variant (for quick list display)
  subtotal: number;
  markup_amount: number;
  tax_amount: number;
  total: number;

  // PDF & sending
  pdf_url: string | null;
  sent_via: "email" | "sms" | null;
  sent_at: string | null; // ISO timestamp

  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

export interface QuotePhoto {
  id: string; // uuid
  quote_id: string; // uuid, references quotes(id)
  user_id: string; // uuid, references auth.users(id)
  url: string;
  created_at: string; // ISO timestamp
}

// Insert types (for creating new records, omit auto-generated fields)

export type ProfileInsert = Omit<Profile, "created_at" | "updated_at">;

export type ProfileUpdate = Partial<
  Omit<Profile, "id" | "created_at" | "updated_at">
>;

export type SettingsInsert = Omit<Settings, "updated_at">;

export type SettingsUpdate = Partial<Omit<Settings, "user_id" | "updated_at">>;

export type MaterialInsert = Omit<Material, "id" | "created_at" | "updated_at">;

export type MaterialUpdate = Partial<
  Omit<Material, "id" | "user_id" | "created_at" | "updated_at">
>;

export type QuoteInsert = Omit<Quote, "id" | "created_at" | "updated_at">;

export type QuoteUpdate = Partial<
  Omit<Quote, "id" | "user_id" | "created_at" | "updated_at">
>;

export type QuotePhotoInsert = Omit<QuotePhoto, "id" | "created_at">;
