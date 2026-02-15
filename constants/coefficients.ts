// constants/coefficients.ts
// Fence calculation coefficients from CLAUDE.md section 6

import type { FenceSpec, FenceType, TerrainType, VariantType } from "@/types/quote";

export const FENCE_SPECS: Record<FenceType, FenceSpec> = {
  wood_privacy: {
    label: "Wood Privacy",
    post_spacing: 8, // ft between posts
    rails_per_section: 3, // horizontal rails per section
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.15,
    available_heights: [4, 5, 6, 8],
    default_height: 6,
  },
  wood_picket: {
    label: "Wood Picket",
    post_spacing: 8,
    rails_per_section: 2,
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.12,
    available_heights: [3, 3.5, 4],
    default_height: 4,
  },
  chain_link: {
    label: "Chain Link",
    post_spacing: 10,
    rails_per_section: 1, // top rail
    concrete_bags_per_post: 0.75,
    labor_hours_per_ft: 0.08,
    available_heights: [4, 5, 6],
    default_height: 4,
  },
  vinyl: {
    label: "Vinyl",
    post_spacing: 8,
    rails_per_section: 0, // panels are self-contained
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.12,
    available_heights: [4, 5, 6],
    default_height: 6,
  },
  aluminum: {
    label: "Aluminum",
    post_spacing: 8,
    rails_per_section: 0,
    concrete_bags_per_post: 0.75,
    labor_hours_per_ft: 0.1,
    available_heights: [4, 5, 6],
    default_height: 4,
  },
};

export const TERRAIN_MULTIPLIERS: Record<TerrainType, number> = {
  flat: 1.0,
  slight_slope: 1.15,
  steep_slope: 1.35,
  rocky: 1.5,
};

export const GATE_LABOR_HOURS = {
  standard: 1.5, // hours per standard gate
  large: 3.0, // hours per large/driveway gate
} as const;

export const REMOVAL_HOURS_PER_FT = 0.05;

export const PICKETS_PER_FOOT: Partial<Record<FenceType, number>> = {
  wood_privacy: 2.4, // tight spacing, ~5 inch picket
  wood_picket: 1.8, // wider spacing
};

export const VARIANT_MARKUP_MODIFIERS: Record<VariantType, number> = {
  budget: -5, // subtract 5% from default markup
  standard: 0, // use default markup as-is
  premium: 10, // add 10% to default markup
};

// Helper to get fence type label
export function getFenceLabel(type: FenceType): string {
  return FENCE_SPECS[type]?.label ?? type;
}

// Helper to get terrain label
export function getTerrainLabel(terrain: TerrainType): string {
  const labels: Record<TerrainType, string> = {
    flat: "Flat",
    slight_slope: "Slight Slope",
    steep_slope: "Steep Slope",
    rocky: "Rocky",
  };
  return labels[terrain] ?? terrain;
}

// Helper to get available heights for fence type
export function getAvailableHeights(type: FenceType): number[] {
  return FENCE_SPECS[type]?.available_heights ?? [4, 5, 6];
}

// Helper to get default height for fence type
export function getDefaultHeight(type: FenceType): number {
  return FENCE_SPECS[type]?.default_height ?? 6;
}
