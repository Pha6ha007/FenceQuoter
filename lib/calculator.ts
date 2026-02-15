// lib/calculator.ts
// Pure calculation functions for fence quotes — CLAUDE.md section 6
// No side effects, no network calls

import {
  FENCE_SPECS,
  GATE_LABOR_HOURS,
  PICKETS_PER_FOOT,
  REMOVAL_HOURS_PER_FT,
  TERRAIN_MULTIPLIERS,
  VARIANT_MARKUP_MODIFIERS,
} from "@/constants/coefficients";
import type {
  CalculatorResult,
  CalculatorSettings,
  FenceType,
  MaterialRecord,
  QuoteInputs,
  QuoteItem,
  QuoteVariant,
  VariantType,
} from "@/types/quote";

// ============================================================
// MAIN CALCULATOR FUNCTION
// ============================================================

export function calculateQuote(
  inputs: QuoteInputs,
  materials: MaterialRecord[],
  settings: CalculatorSettings
): CalculatorResult {
  const spec = FENCE_SPECS[inputs.fence_type];
  if (!spec) {
    throw new Error(`Unknown fence type: ${inputs.fence_type}`);
  }

  // Filter materials for this fence type
  const fenceMaterials = materials.filter(
    (m) => m.fence_type === inputs.fence_type && m.is_active !== false
  );

  // Calculate quantities
  const posts = Math.ceil(inputs.length / spec.post_spacing) + 1;
  const sections = posts - 1;

  // Build material items
  const materialItems = buildMaterialItems(
    inputs,
    fenceMaterials,
    spec,
    posts,
    sections
  );

  // Calculate labor
  const laborItems = buildLaborItems(inputs, spec, settings.hourly_rate);

  // Combine all items
  const baseItems = [...materialItems, ...laborItems];

  // Calculate totals
  const materialsTotal = sumByCategory(baseItems, "material");
  const laborTotal =
    sumByCategory(baseItems, "labor") + sumByCategory(baseItems, "removal");
  const subtotal = materialsTotal + laborTotal;

  // Generate 3 variants
  const variantTypes: VariantType[] = ["budget", "standard", "premium"];
  const variants: QuoteVariant[] = variantTypes.map((type) =>
    buildVariant(
      type,
      baseItems,
      subtotal,
      materialsTotal,
      laborTotal,
      settings.default_markup_percent,
      settings.tax_percent
    )
  );

  return { variants };
}

// ============================================================
// MATERIAL ITEMS
// ============================================================

function buildMaterialItems(
  inputs: QuoteInputs,
  materials: MaterialRecord[],
  spec: (typeof FENCE_SPECS)[FenceType],
  posts: number,
  sections: number
): QuoteItem[] {
  const items: QuoteItem[] = [];

  // Helper to find material by category
  const findMaterial = (category: string): MaterialRecord | undefined =>
    materials.find((m) => m.category === category);

  // 1. Posts
  const postMaterial = findMaterial("post");
  if (postMaterial) {
    items.push(
      createMaterialItem(postMaterial.name, posts, postMaterial.unit, postMaterial.unit_price)
    );
  }

  // 2. Rails (if fence type uses them)
  if (spec.rails_per_section > 0) {
    const railMaterial = findMaterial("rail");
    if (railMaterial) {
      const railQty = sections * spec.rails_per_section;
      items.push(
        createMaterialItem(railMaterial.name, railQty, railMaterial.unit, railMaterial.unit_price)
      );
    }
  }

  // 3. Panels/Pickets
  const panelMaterial = findMaterial("panel");
  if (panelMaterial) {
    const isPanelBased =
      inputs.fence_type === "vinyl" || inputs.fence_type === "aluminum";
    const isChainLink = inputs.fence_type === "chain_link";

    let panelQty: number;
    if (isPanelBased) {
      // Panel-based: one panel per section
      panelQty = sections;
    } else if (isChainLink) {
      // Chain link: fabric per linear foot
      panelQty = inputs.length;
    } else {
      // Picket-based (wood): pickets per foot
      const picketsPerFoot = PICKETS_PER_FOOT[inputs.fence_type] ?? 2;
      panelQty = Math.ceil(inputs.length * picketsPerFoot);
    }

    items.push(
      createMaterialItem(panelMaterial.name, panelQty, panelMaterial.unit, panelMaterial.unit_price)
    );
  }

  // 4. Concrete
  const concreteMaterial = findMaterial("concrete");
  if (concreteMaterial) {
    const concreteQty = Math.ceil(posts * spec.concrete_bags_per_post);
    items.push(
      createMaterialItem(
        concreteMaterial.name,
        concreteQty,
        concreteMaterial.unit,
        concreteMaterial.unit_price
      )
    );
  }

  // 5. Hardware
  const hardwareMaterial = findMaterial("hardware");
  if (hardwareMaterial) {
    items.push(
      createMaterialItem(
        hardwareMaterial.name,
        sections,
        hardwareMaterial.unit,
        hardwareMaterial.unit_price
      )
    );
  }

  // 6. Gates
  const gateMaterials = materials.filter((m) => m.category === "gate");
  const standardGate = gateMaterials.find(
    (m) => m.name.toLowerCase().includes("walk") || m.name.toLowerCase().includes("standard")
  );
  const largeGate = gateMaterials.find(
    (m) => m.name.toLowerCase().includes("double") || m.name.toLowerCase().includes("driveway")
  );

  if (inputs.gates_standard > 0 && standardGate) {
    items.push(
      createMaterialItem(
        standardGate.name,
        inputs.gates_standard,
        standardGate.unit,
        standardGate.unit_price
      )
    );
  }

  if (inputs.gates_large > 0 && largeGate) {
    items.push(
      createMaterialItem(largeGate.name, inputs.gates_large, largeGate.unit, largeGate.unit_price)
    );
  }

  return items;
}

function createMaterialItem(
  name: string,
  qty: number,
  unit: string,
  unitPrice: number
): QuoteItem {
  return {
    name,
    qty: round2(qty),
    unit,
    unit_price: round2(unitPrice),
    total: round2(qty * unitPrice),
    category: "material",
  };
}

// ============================================================
// LABOR ITEMS
// ============================================================

function buildLaborItems(
  inputs: QuoteInputs,
  spec: (typeof FENCE_SPECS)[FenceType],
  hourlyRate: number
): QuoteItem[] {
  const items: QuoteItem[] = [];
  const terrainMultiplier = TERRAIN_MULTIPLIERS[inputs.terrain] ?? 1;

  // Base fence installation labor
  const baseHours = inputs.length * spec.labor_hours_per_ft;
  const adjustedBaseHours = baseHours * terrainMultiplier;

  if (adjustedBaseHours > 0) {
    items.push({
      name: "Fence installation labor",
      qty: round2(adjustedBaseHours),
      unit: "hours",
      unit_price: round2(hourlyRate),
      total: round2(adjustedBaseHours * hourlyRate),
      category: "labor",
    });
  }

  // Gate installation labor
  const gateHours =
    inputs.gates_standard * GATE_LABOR_HOURS.standard +
    inputs.gates_large * GATE_LABOR_HOURS.large;

  if (gateHours > 0) {
    const adjustedGateHours = gateHours * terrainMultiplier;
    items.push({
      name: "Gate installation labor",
      qty: round2(adjustedGateHours),
      unit: "hours",
      unit_price: round2(hourlyRate),
      total: round2(adjustedGateHours * hourlyRate),
      category: "labor",
    });
  }

  // Old fence removal labor
  if (inputs.remove_old) {
    const removalHours = inputs.length * REMOVAL_HOURS_PER_FT * terrainMultiplier;
    items.push({
      name: "Old fence removal",
      qty: round2(removalHours),
      unit: "hours",
      unit_price: round2(hourlyRate),
      total: round2(removalHours * hourlyRate),
      category: "removal",
    });
  }

  return items;
}

// ============================================================
// VARIANT BUILDER
// ============================================================

function buildVariant(
  type: VariantType,
  baseItems: QuoteItem[],
  subtotal: number,
  materialsTotal: number,
  laborTotal: number,
  defaultMarkupPercent: number,
  taxPercent: number
): QuoteVariant {
  const markupModifier = VARIANT_MARKUP_MODIFIERS[type];
  const effectiveMarkup = Math.max(0, defaultMarkupPercent + markupModifier);

  const markupAmount = subtotal * (effectiveMarkup / 100);
  const taxableAmount = subtotal + markupAmount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const total = subtotal + markupAmount + taxAmount;

  return {
    type,
    markup_percent: effectiveMarkup,
    items: baseItems.map((item) => ({ ...item })), // clone items
    materials_total: round2(materialsTotal),
    labor_total: round2(laborTotal),
    subtotal: round2(subtotal),
    markup_amount: round2(markupAmount),
    tax_amount: round2(taxAmount),
    total: round2(total),
  };
}

// ============================================================
// HELPERS
// ============================================================

function sumByCategory(items: QuoteItem[], category: QuoteItem["category"]): number {
  return items
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + item.total, 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================
// UTILITY FUNCTIONS (exported for use in components)
// ============================================================

/**
 * Calculate posts count for a given length and fence type
 */
export function calculatePostsCount(length: number, fenceType: FenceType): number {
  const spec = FENCE_SPECS[fenceType];
  if (!spec) return 0;
  return Math.ceil(length / spec.post_spacing) + 1;
}

/**
 * Calculate sections count for a given length and fence type
 */
export function calculateSectionsCount(length: number, fenceType: FenceType): number {
  return Math.max(0, calculatePostsCount(length, fenceType) - 1);
}

/**
 * Get estimated labor hours for a quote
 */
export function estimateLaborHours(inputs: QuoteInputs): number {
  const spec = FENCE_SPECS[inputs.fence_type];
  if (!spec) return 0;

  const terrainMultiplier = TERRAIN_MULTIPLIERS[inputs.terrain] ?? 1;

  const baseHours = inputs.length * spec.labor_hours_per_ft;
  const gateHours =
    inputs.gates_standard * GATE_LABOR_HOURS.standard +
    inputs.gates_large * GATE_LABOR_HOURS.large;
  const removalHours = inputs.remove_old ? inputs.length * REMOVAL_HOURS_PER_FT : 0;

  return round2((baseHours + gateHours + removalHours) * terrainMultiplier);
}

/**
 * Recalculate variant totals with a new markup percentage
 */
export function recalculateWithMarkup(
  variant: QuoteVariant,
  newMarkupPercent: number,
  taxPercent: number
): QuoteVariant {
  const markupAmount = variant.subtotal * (newMarkupPercent / 100);
  const taxableAmount = variant.subtotal + markupAmount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const total = variant.subtotal + markupAmount + taxAmount;

  return {
    ...variant,
    markup_percent: newMarkupPercent,
    markup_amount: round2(markupAmount),
    tax_amount: round2(taxAmount),
    total: round2(total),
  };
}

/**
 * Add a custom item to a variant and recalculate totals
 */
export function addCustomItem(
  variant: QuoteVariant,
  customItem: { name: string; qty: number; unit_price: number },
  taxPercent: number
): QuoteVariant {
  const itemTotal = round2(customItem.qty * customItem.unit_price);

  const newItem: QuoteItem = {
    name: customItem.name,
    qty: customItem.qty,
    unit: "each",
    unit_price: customItem.unit_price,
    total: itemTotal,
    category: "custom",
  };

  const newItems = [...variant.items, newItem];
  const newSubtotal = round2(variant.subtotal + itemTotal);

  const markupAmount = newSubtotal * (variant.markup_percent / 100);
  const taxableAmount = newSubtotal + markupAmount;
  const taxAmount = taxableAmount * (taxPercent / 100);
  const total = newSubtotal + markupAmount + taxAmount;

  return {
    ...variant,
    items: newItems,
    subtotal: newSubtotal,
    markup_amount: round2(markupAmount),
    tax_amount: round2(taxAmount),
    total: round2(total),
  };
}
