// constants/defaults.ts
// Regional defaults and seed data from CLAUDE.md section 6

import type { RegionalDefault, RegionCode } from "@/types/quote";

export const REGIONAL_DEFAULTS: Record<RegionCode, RegionalDefault> = {
  US: {
    currency: "USD",
    unit_system: "imperial",
    hourly_rate: 45,
    symbol: "$",
  },
  CA: {
    currency: "CAD",
    unit_system: "imperial",
    hourly_rate: 50,
    symbol: "C$",
  },
  UK: {
    currency: "GBP",
    unit_system: "metric",
    hourly_rate: 35,
    symbol: "£",
  },
  AU: {
    currency: "AUD",
    unit_system: "metric",
    hourly_rate: 55,
    symbol: "A$",
  },
  EU: {
    currency: "EUR",
    unit_system: "metric",
    hourly_rate: 40,
    symbol: "€",
  },
  Other: {
    currency: "USD",
    unit_system: "metric",
    hourly_rate: 30,
    symbol: "$",
  },
};

// All supported regions
export const REGIONS: RegionCode[] = ["US", "CA", "UK", "AU", "EU", "Other"];

// Get regional defaults with fallback
export function getRegionalDefaults(region: string): RegionalDefault {
  const code = region as RegionCode;
  return REGIONAL_DEFAULTS[code] ?? REGIONAL_DEFAULTS.Other;
}

// Get currency symbol for currency code
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    CAD: "C$",
    GBP: "£",
    EUR: "€",
    AUD: "A$",
  };
  return symbols[currency] ?? "$";
}

// Format money value
export function formatMoney(symbol: string, value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return `${symbol}${n.toFixed(2)}`;
}

// Default terms template
export const DEFAULT_TERMS_TEMPLATE =
  "Thank you for the opportunity to quote this project. This quote is valid for 30 days. Material prices may vary.";

// Free tier limits
export const FREE_TIER_LIMITS = {
  quotes_per_month: 3,
} as const;

// Pro subscription pricing (display only, actual prices from RevenueCat)
export const PRO_PRICING = {
  monthly: 49,
  yearly_per_month: 39,
} as const;
