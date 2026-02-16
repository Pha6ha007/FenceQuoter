
// __tests__/calculator.test.ts
// Unit tests for lib/calculator.ts — CLAUDE.md section 2

import {
  addCustomItem,
  calculatePostsCount,
  calculateQuote,
  calculateSectionsCount,
  estimateLaborHours,
  recalculateWithMarkup,
} from "@/lib/calculator";
import type {
  CalculatorSettings,
  MaterialRecord,
  QuoteInputs,
} from "@/types/quote";

// ============================================================
// TEST DATA
// ============================================================

const defaultSettings: CalculatorSettings = {
  hourly_rate: 45,
  default_markup_percent: 20,
  tax_percent: 8,
};

const woodPrivacyMaterials: MaterialRecord[] = [
  { id: "1", user_id: "u1", fence_type: "wood_privacy", name: "4x4 Post (8ft)", unit: "each", unit_price: 14.0, category: "post", sort_order: 1 },
  { id: "2", user_id: "u1", fence_type: "wood_privacy", name: "2x4 Rail (8ft)", unit: "each", unit_price: 5.5, category: "rail", sort_order: 2 },
  { id: "3", user_id: "u1", fence_type: "wood_privacy", name: "Privacy picket (6ft)", unit: "each", unit_price: 3.25, category: "panel", sort_order: 3 },
  { id: "4", user_id: "u1", fence_type: "wood_privacy", name: "Concrete (50lb)", unit: "bag", unit_price: 5.5, category: "concrete", sort_order: 4 },
  { id: "5", user_id: "u1", fence_type: "wood_privacy", name: "Hardware set", unit: "set", unit_price: 8.0, category: "hardware", sort_order: 5 },
  { id: "6", user_id: "u1", fence_type: "wood_privacy", name: "Walk gate", unit: "each", unit_price: 85.0, category: "gate", sort_order: 6 },
  { id: "7", user_id: "u1", fence_type: "wood_privacy", name: "Double driveway gate", unit: "each", unit_price: 250.0, category: "gate", sort_order: 7 },
];

const chainLinkMaterials: MaterialRecord[] = [
  { id: "10", user_id: "u1", fence_type: "chain_link", name: "Terminal post", unit: "each", unit_price: 18.0, category: "post", sort_order: 1 },
  { id: "11", user_id: "u1", fence_type: "chain_link", name: "Top rail (10.5ft)", unit: "each", unit_price: 9.5, category: "rail", sort_order: 2 },
  { id: "12", user_id: "u1", fence_type: "chain_link", name: "Chain link fabric", unit: "ft", unit_price: 3.75, category: "panel", sort_order: 3 },
  { id: "13", user_id: "u1", fence_type: "chain_link", name: "Concrete (50lb)", unit: "bag", unit_price: 5.5, category: "concrete", sort_order: 4 },
  { id: "14", user_id: "u1", fence_type: "chain_link", name: "Hardware set", unit: "set", unit_price: 6.0, category: "hardware", sort_order: 5 },
  { id: "15", user_id: "u1", fence_type: "chain_link", name: "Walk gate (4ft)", unit: "each", unit_price: 95.0, category: "gate", sort_order: 6 },
  { id: "16", user_id: "u1", fence_type: "chain_link", name: "Double driveway gate", unit: "each", unit_price: 275.0, category: "gate", sort_order: 7 },
];

const vinylMaterials: MaterialRecord[] = [
  { id: "20", user_id: "u1", fence_type: "vinyl", name: "Vinyl post (5x5)", unit: "each", unit_price: 28.0, category: "post", sort_order: 1 },
  { id: "21", user_id: "u1", fence_type: "vinyl", name: "Vinyl panel (6x8)", unit: "each", unit_price: 65.0, category: "panel", sort_order: 2 },
  { id: "22", user_id: "u1", fence_type: "vinyl", name: "Concrete (50lb)", unit: "bag", unit_price: 5.5, category: "concrete", sort_order: 3 },
  { id: "23", user_id: "u1", fence_type: "vinyl", name: "Hardware kit", unit: "set", unit_price: 5.0, category: "hardware", sort_order: 4 },
  { id: "24", user_id: "u1", fence_type: "vinyl", name: "Standard vinyl gate", unit: "each", unit_price: 150.0, category: "gate", sort_order: 5 },
  { id: "25", user_id: "u1", fence_type: "vinyl", name: "Double vinyl gate", unit: "each", unit_price: 400.0, category: "gate", sort_order: 6 },
];

const aluminumMaterials: MaterialRecord[] = [
  { id: "30", user_id: "u1", fence_type: "aluminum", name: "Aluminum post (2x2)", unit: "each", unit_price: 22.0, category: "post", sort_order: 1 },
  { id: "31", user_id: "u1", fence_type: "aluminum", name: "Aluminum panel (6ft)", unit: "each", unit_price: 55.0, category: "panel", sort_order: 2 },
  { id: "32", user_id: "u1", fence_type: "aluminum", name: "Concrete (50lb)", unit: "bag", unit_price: 5.5, category: "concrete", sort_order: 3 },
  { id: "33", user_id: "u1", fence_type: "aluminum", name: "Hardware set", unit: "set", unit_price: 6.0, category: "hardware", sort_order: 4 },
  { id: "34", user_id: "u1", fence_type: "aluminum", name: "Aluminum walk gate", unit: "each", unit_price: 175.0, category: "gate", sort_order: 5 },
  { id: "35", user_id: "u1", fence_type: "aluminum", name: "Double aluminum gate", unit: "each", unit_price: 450.0, category: "gate", sort_order: 6 },
];

const woodPicketMaterials: MaterialRecord[] = [
  { id: "40", user_id: "u1", fence_type: "wood_picket", name: "4x4 Post (6ft)", unit: "each", unit_price: 10.0, category: "post", sort_order: 1 },
  { id: "41", user_id: "u1", fence_type: "wood_picket", name: "2x4 Rail (8ft)", unit: "each", unit_price: 5.5, category: "rail", sort_order: 2 },
  { id: "42", user_id: "u1", fence_type: "wood_picket", name: "Picket (42in)", unit: "each", unit_price: 2.0, category: "panel", sort_order: 3 },
  { id: "43", user_id: "u1", fence_type: "wood_picket", name: "Concrete (50lb)", unit: "bag", unit_price: 5.5, category: "concrete", sort_order: 4 },
  { id: "44", user_id: "u1", fence_type: "wood_picket", name: "Hardware set", unit: "set", unit_price: 6.0, category: "hardware", sort_order: 5 },
  { id: "45", user_id: "u1", fence_type: "wood_picket", name: "Walk gate (picket)", unit: "each", unit_price: 70.0, category: "gate", sort_order: 6 },
  { id: "46", user_id: "u1", fence_type: "wood_picket", name: "Double gate (picket)", unit: "each", unit_price: 180.0, category: "gate", sort_order: 7 },
];

// ============================================================
// WOOD PRIVACY TESTS
// ============================================================

describe("calculateQuote - wood_privacy", () => {
  const baseInputs: QuoteInputs = {
    fence_type: "wood_privacy",
    length: 100,
    height: 6,
    gates_standard: 1,
    gates_large: 0,
    remove_old: false,
    terrain: "flat",
  };

  it("returns 3 variants (budget, standard, premium)", () => {
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);

    expect(result.variants).toHaveLength(3);
    expect(result.variants.map((v) => v.type)).toEqual(["budget", "standard", "premium"]);
  });

  it("calculates correct post count for 100ft fence", () => {
    // post_spacing = 8ft, so posts = ceil(100/8) + 1 = 13 + 1 = 14
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const postItem = result.variants[0].items.find((i) => i.name.includes("Post"));

    expect(postItem?.qty).toBe(14);
  });

  it("calculates correct rail count", () => {
    // sections = 13, rails_per_section = 3, so rails = 13 * 3 = 39
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const railItem = result.variants[0].items.find((i) => i.name.includes("Rail"));

    expect(railItem?.qty).toBe(39);
  });

  it("calculates correct picket count", () => {
    // length = 100ft, pickets_per_foot = 2.4, so pickets = ceil(100 * 2.4) = 240
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const picketItem = result.variants[0].items.find((i) => i.name.includes("picket"));

    expect(picketItem?.qty).toBe(240);
  });

  it("includes gate in materials", () => {
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const gateItem = result.variants[0].items.find((i) => i.name.includes("Walk gate"));

    expect(gateItem?.qty).toBe(1);
    expect(gateItem?.total).toBe(85);
  });

  it("applies terrain multiplier to labor", () => {
    const steepInputs: QuoteInputs = { ...baseInputs, terrain: "steep_slope" };
    const flatResult = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const steepResult = calculateQuote(steepInputs, woodPrivacyMaterials, defaultSettings);

    // steep_slope multiplier = 1.35, so labor should be higher
    expect(steepResult.variants[0].labor_total).toBeGreaterThan(flatResult.variants[0].labor_total);
    expect(steepResult.variants[0].labor_total).toBeCloseTo(flatResult.variants[0].labor_total * 1.35, 1);
  });

  it("includes removal labor when remove_old is true", () => {
    const withRemoval: QuoteInputs = { ...baseInputs, remove_old: true };
    const result = calculateQuote(withRemoval, woodPrivacyMaterials, defaultSettings);
    const removalItem = result.variants[0].items.find((i) => i.category === "removal");

    expect(removalItem).toBeDefined();
    expect(removalItem!.qty).toBeGreaterThan(0);
  });

  it("budget variant has lower markup than standard", () => {
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);

    expect(result.variants[0].markup_percent).toBe(15); // 20 - 5
    expect(result.variants[1].markup_percent).toBe(20); // 20 + 0
    expect(result.variants[2].markup_percent).toBe(30); // 20 + 10
  });

  it("premium variant has highest total", () => {
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);

    expect(result.variants[2].total).toBeGreaterThan(result.variants[1].total);
    expect(result.variants[1].total).toBeGreaterThan(result.variants[0].total);
  });

  it("calculates tax correctly", () => {
    const result = calculateQuote(baseInputs, woodPrivacyMaterials, defaultSettings);
    const variant = result.variants[1]; // standard

    const expectedTax = (variant.subtotal + variant.markup_amount) * 0.08;
    expect(variant.tax_amount).toBeCloseTo(expectedTax, 2);
  });
});

// ============================================================
// CHAIN LINK TESTS
// ============================================================

describe("calculateQuote - chain_link", () => {
  const baseInputs: QuoteInputs = {
    fence_type: "chain_link",
    length: 150,
    height: 4,
    gates_standard: 2,
    gates_large: 1,
    remove_old: false,
    terrain: "flat",
  };

  it("calculates correct post count for 150ft fence", () => {
    // post_spacing = 10ft, so posts = ceil(150/10) + 1 = 15 + 1 = 16
    const result = calculateQuote(baseInputs, chainLinkMaterials, defaultSettings);
    const postItem = result.variants[0].items.find((i) => i.name.includes("post"));

    expect(postItem?.qty).toBe(16);
  });

  it("calculates chain link fabric per linear foot", () => {
    const result = calculateQuote(baseInputs, chainLinkMaterials, defaultSettings);
    const fabricItem = result.variants[0].items.find((i) => i.name.includes("fabric"));

    expect(fabricItem?.qty).toBe(150);
  });

  it("includes both standard and large gates", () => {
    const result = calculateQuote(baseInputs, chainLinkMaterials, defaultSettings);
    const walkGate = result.variants[0].items.find((i) => i.name.includes("Walk gate"));
    const largeGate = result.variants[0].items.find((i) => i.name.includes("Double"));

    expect(walkGate?.qty).toBe(2);
    expect(largeGate?.qty).toBe(1);
  });

  it("calculates gate labor hours correctly", () => {
    // 2 standard gates * 1.5h + 1 large gate * 3h = 6h
    const laborHours = estimateLaborHours(baseInputs);
    const baseFenceHours = 150 * 0.08; // length * labor_hours_per_ft
    const gateHours = 2 * 1.5 + 1 * 3;

    expect(laborHours).toBeCloseTo(baseFenceHours + gateHours, 2);
  });
});

// ============================================================
// VINYL TESTS
// ============================================================

describe("calculateQuote - vinyl", () => {
  const baseInputs: QuoteInputs = {
    fence_type: "vinyl",
    length: 80,
    height: 6,
    gates_standard: 0,
    gates_large: 0,
    remove_old: false,
    terrain: "flat",
  };

  it("calculates panel count based on sections (not pickets)", () => {
    // post_spacing = 8ft, posts = ceil(80/8) + 1 = 11, sections = 10
    const result = calculateQuote(baseInputs, vinylMaterials, defaultSettings);
    const panelItem = result.variants[0].items.find((i) => i.name.includes("panel"));

    expect(panelItem?.qty).toBe(10);
  });

  it("has no rail items (vinyl is panel-based)", () => {
    const result = calculateQuote(baseInputs, vinylMaterials, defaultSettings);
    const railItem = result.variants[0].items.find((i) => i.name.toLowerCase().includes("rail"));

    expect(railItem).toBeUndefined();
  });
});

// ============================================================
// ALUMINUM TESTS
// ============================================================

describe("calculateQuote - aluminum", () => {
  const baseInputs: QuoteInputs = {
    fence_type: "aluminum",
    length: 64,
    height: 4,
    gates_standard: 1,
    gates_large: 0,
    remove_old: false,
    terrain: "slight_slope",
  };

  it("calculates correct sections for 64ft fence", () => {
    // post_spacing = 8ft, posts = ceil(64/8) + 1 = 8 + 1 = 9, sections = 8
    const result = calculateQuote(baseInputs, aluminumMaterials, defaultSettings);
    const panelItem = result.variants[0].items.find((i) => i.name.includes("panel"));

    expect(panelItem?.qty).toBe(8);
  });

  it("applies slight_slope terrain multiplier (1.15)", () => {
    const flatInputs: QuoteInputs = { ...baseInputs, terrain: "flat" };
    const flatResult = calculateQuote(flatInputs, aluminumMaterials, defaultSettings);
    const slopeResult = calculateQuote(baseInputs, aluminumMaterials, defaultSettings);

    expect(slopeResult.variants[0].labor_total).toBeCloseTo(
      flatResult.variants[0].labor_total * 1.15,
      1
    );
  });
});

// ============================================================
// WOOD PICKET TESTS
// ============================================================

describe("calculateQuote - wood_picket", () => {
  const baseInputs: QuoteInputs = {
    fence_type: "wood_picket",
    length: 50,
    height: 4,
    gates_standard: 1,
    gates_large: 0,
    remove_old: true,
    terrain: "rocky",
  };

  it("calculates correct picket count with 1.8 per foot", () => {
    // length = 50ft, pickets_per_foot = 1.8, so pickets = ceil(50 * 1.8) = 90
    const result = calculateQuote(baseInputs, woodPicketMaterials, defaultSettings);
    const picketItem = result.variants[0].items.find((i) => i.name.includes("Picket"));

    expect(picketItem?.qty).toBe(90);
  });

  it("calculates rail count with 2 rails per section", () => {
    // post_spacing = 8ft, posts = ceil(50/8) + 1 = 7 + 1 = 8, sections = 7
    // rails = 7 * 2 = 14
    const result = calculateQuote(baseInputs, woodPicketMaterials, defaultSettings);
    const railItem = result.variants[0].items.find((i) => i.name.includes("Rail"));

    expect(railItem?.qty).toBe(14);
  });

  it("applies rocky terrain multiplier (1.5) to all labor", () => {
    const flatInputs: QuoteInputs = { ...baseInputs, terrain: "flat", remove_old: false };
    const rockyInputs: QuoteInputs = { ...baseInputs, terrain: "rocky", remove_old: false };

    const flatResult = calculateQuote(flatInputs, woodPicketMaterials, defaultSettings);
    const rockyResult = calculateQuote(rockyInputs, woodPicketMaterials, defaultSettings);

    expect(rockyResult.variants[0].labor_total).toBeCloseTo(
      flatResult.variants[0].labor_total * 1.5,
      1
    );
  });
});

// ============================================================
// UTILITY FUNCTION TESTS
// ============================================================

describe("calculatePostsCount", () => {
  it("returns correct count for wood_privacy", () => {
    expect(calculatePostsCount(100, "wood_privacy")).toBe(14); // ceil(100/8) + 1
    expect(calculatePostsCount(80, "wood_privacy")).toBe(11);  // ceil(80/8) + 1
    expect(calculatePostsCount(8, "wood_privacy")).toBe(2);    // ceil(8/8) + 1
  });

  it("returns correct count for chain_link", () => {
    expect(calculatePostsCount(100, "chain_link")).toBe(11); // ceil(100/10) + 1
    expect(calculatePostsCount(150, "chain_link")).toBe(16); // ceil(150/10) + 1
  });
});

describe("calculateSectionsCount", () => {
  it("returns posts - 1", () => {
    expect(calculateSectionsCount(100, "wood_privacy")).toBe(13);
    expect(calculateSectionsCount(100, "chain_link")).toBe(10);
  });
});

describe("estimateLaborHours", () => {
  it("calculates base hours correctly", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    // labor_hours_per_ft = 0.15, so hours = 100 * 0.15 = 15
    expect(estimateLaborHours(inputs)).toBe(15);
  });

  it("includes gate hours", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 2,
      gates_large: 1,
      remove_old: false,
      terrain: "flat",
    };

    // base = 15, gates = 2*1.5 + 1*3 = 6, total = 21
    expect(estimateLaborHours(inputs)).toBe(21);
  });

  it("includes removal hours", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: true,
      terrain: "flat",
    };

    // base = 15, removal = 100 * 0.05 = 5, total = 20
    expect(estimateLaborHours(inputs)).toBe(20);
  });
});

describe("recalculateWithMarkup", () => {
  it("recalculates totals with new markup", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    const result = calculateQuote(inputs, woodPrivacyMaterials, defaultSettings);
    const original = result.variants[1]; // standard, 20% markup

    const recalculated = recalculateWithMarkup(original, 30, 8);

    expect(recalculated.markup_percent).toBe(30);
    expect(recalculated.markup_amount).toBeCloseTo(original.subtotal * 0.3, 2);
    expect(recalculated.total).toBeGreaterThan(original.total);
  });
});

describe("addCustomItem", () => {
  it("adds custom item and recalculates totals", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    const result = calculateQuote(inputs, woodPrivacyMaterials, defaultSettings);
    const original = result.variants[1];

    const withCustom = addCustomItem(
      original,
      { name: "Extra cleanup", qty: 2, unit_price: 75 },
      8
    );

    expect(withCustom.items.length).toBe(original.items.length + 1);
    expect(withCustom.subtotal).toBe(original.subtotal + 150);
    expect(withCustom.total).toBeGreaterThan(original.total);

    const customItem = withCustom.items.find((i) => i.name === "Extra cleanup");
    expect(customItem?.category).toBe("custom");
    expect(customItem?.total).toBe(150);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe("edge cases", () => {
  it("handles zero length gracefully", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 0,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    const result = calculateQuote(inputs, woodPrivacyMaterials, defaultSettings);

    expect(result.variants).toHaveLength(3);
    expect(result.variants[0].total).toBeGreaterThanOrEqual(0);
  });

  it("handles no materials gracefully", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    const result = calculateQuote(inputs, [], defaultSettings);

    expect(result.variants).toHaveLength(3);
    // Should still have labor items
    expect(result.variants[0].labor_total).toBeGreaterThan(0);
  });

  it("handles zero markup gracefully", () => {
    const inputs: QuoteInputs = {
      fence_type: "wood_privacy",
      length: 100,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    };

    const zeroMarkupSettings: CalculatorSettings = {
      ...defaultSettings,
      default_markup_percent: 0,
    };

    const result = calculateQuote(inputs, woodPrivacyMaterials, zeroMarkupSettings);

    // budget would be -5% but should be clamped to 0
    expect(result.variants[0].markup_percent).toBe(0);
    expect(result.variants[0].markup_amount).toBe(0);
  });

  it("handles very large fence length", () => {
    const inputs: QuoteInputs = {
      fence_type: "chain_link",
      length: 5000,
      height: 6,
      gates_standard: 10,
      gates_large: 5,
      remove_old: true,
      terrain: "rocky",
    };

    const result = calculateQuote(inputs, chainLinkMaterials, defaultSettings);

    expect(result.variants).toHaveLength(3);
    expect(result.variants[2].total).toBeGreaterThan(0);
  });
});
