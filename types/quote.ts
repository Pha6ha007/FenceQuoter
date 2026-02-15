// types/quote.ts
// All quote-related types as defined in CLAUDE.md section 6

export type FenceType =
  | "wood_privacy"
  | "wood_picket"
  | "chain_link"
  | "vinyl"
  | "aluminum";

export type TerrainType = "flat" | "slight_slope" | "steep_slope" | "rocky";

export type VariantType = "budget" | "standard" | "premium";

export type QuoteItemCategory = "material" | "labor" | "removal" | "custom";

export type QuoteStatus =
  | "draft"
  | "calculated"
  | "sent"
  | "accepted"
  | "rejected";

export type UnitSystem = "imperial" | "metric";

export type RegionCode = "US" | "CA" | "UK" | "AU" | "EU" | "Other";

export interface QuoteInputs {
  fence_type: FenceType;
  length: number; // in unit_system units (ft or m)
  height: number; // in unit_system units (ft or m)
  gates_standard: number;
  gates_large: number;
  remove_old: boolean;
  terrain: TerrainType;
  notes?: string;
}

export interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  category: QuoteItemCategory;
}

export interface QuoteVariant {
  type: VariantType;
  markup_percent: number;
  items: QuoteItem[];
  materials_total: number;
  labor_total: number;
  subtotal: number;
  markup_amount: number;
  tax_amount: number;
  total: number;
}

export interface CalculatorResult {
  variants: QuoteVariant[];
}

export interface CalculatorSettings {
  hourly_rate: number;
  default_markup_percent: number;
  tax_percent: number;
}

export interface MaterialRecord {
  id: string;
  user_id: string;
  fence_type: FenceType;
  name: string;
  unit: string;
  unit_price: number;
  category: string; // post | rail | panel | concrete | hardware | gate
  sort_order: number;
  is_active?: boolean;
}

export interface FenceSpec {
  label: string;
  post_spacing: number; // ft between posts
  rails_per_section: number; // horizontal rails per section
  concrete_bags_per_post: number;
  labor_hours_per_ft: number;
  available_heights: number[];
  default_height: number;
}

export interface RegionalDefault {
  currency: string;
  unit_system: UnitSystem;
  hourly_rate: number;
  symbol: string;
}

export interface CustomItem {
  name: string;
  qty: number;
  unit_price: number;
  total: number;
}
