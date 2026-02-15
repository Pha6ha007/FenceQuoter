// __tests__/validation.test.ts
// Unit tests for lib/validation.ts — CLAUDE.md section 2

import {
  clientInfoSchema,
  customItemSchema,
  isValidEmail,
  isValidPhone,
  loginSchema,
  materialSchema,
  onboardingSchema,
  parseNumber,
  parseInt,
  profileSchema,
  quoteFormSchema,
  quoteInputsSchema,
  registerSchema,
  resetPasswordSchema,
  sanitize,
  sendEmailSchema,
  sendSmsSchema,
  settingsSchema,
  validate,
  validateOrThrow,
} from "@/lib/validation";

// ============================================================
// QUOTE INPUTS VALIDATION
// ============================================================

describe("quoteInputsSchema", () => {
  const validInputs = {
    fence_type: "wood_privacy",
    length: 100,
    height: 6,
    gates_standard: 1,
    gates_large: 0,
    remove_old: false,
    terrain: "flat",
  };

  it("accepts valid inputs", () => {
    const result = quoteInputsSchema.safeParse(validInputs);
    expect(result.success).toBe(true);
  });

  it("accepts all fence types", () => {
    const fenceTypes = ["wood_privacy", "wood_picket", "chain_link", "vinyl", "aluminum"];

    for (const fence_type of fenceTypes) {
      const result = quoteInputsSchema.safeParse({ ...validInputs, fence_type });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all terrain types", () => {
    const terrains = ["flat", "slight_slope", "steep_slope", "rocky"];

    for (const terrain of terrains) {
      const result = quoteInputsSchema.safeParse({ ...validInputs, terrain });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid fence type", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, fence_type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("rejects negative length", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, length: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects zero length", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, length: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects length over 10000", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, length: 15000 });
    expect(result.success).toBe(false);
  });

  it("rejects negative gates count", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, gates_standard: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer gates count", () => {
    const result = quoteInputsSchema.safeParse({ ...validInputs, gates_standard: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const result = quoteInputsSchema.safeParse({
      ...validInputs,
      notes: "Some notes about the project",
    });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 2000 chars", () => {
    const result = quoteInputsSchema.safeParse({
      ...validInputs,
      notes: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CLIENT INFO VALIDATION
// ============================================================

describe("clientInfoSchema", () => {
  it("accepts valid client info", () => {
    const result = clientInfoSchema.safeParse({
      client_name: "John Doe",
      client_email: "john@example.com",
      client_phone: "+1234567890",
      client_address: "123 Main St",
    });
    expect(result.success).toBe(true);
  });

  it("requires client_name", () => {
    const result = clientInfoSchema.safeParse({
      client_name: "",
      client_email: "john@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty optional fields", () => {
    const result = clientInfoSchema.safeParse({
      client_name: "John Doe",
      client_email: "",
      client_phone: "",
      client_address: "",
    });
    expect(result.success).toBe(true);
  });

  it("validates email format", () => {
    const result = clientInfoSchema.safeParse({
      client_name: "John Doe",
      client_email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = clientInfoSchema.safeParse({
      client_name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// COMBINED QUOTE FORM VALIDATION
// ============================================================

describe("quoteFormSchema", () => {
  it("accepts complete valid form", () => {
    const result = quoteFormSchema.safeParse({
      client_name: "John Doe",
      client_email: "john@example.com",
      client_phone: "+1234567890",
      client_address: "123 Main St",
      fence_type: "vinyl",
      length: 150,
      height: 6,
      gates_standard: 2,
      gates_large: 1,
      remove_old: true,
      terrain: "slight_slope",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when client_name missing", () => {
    const result = quoteFormSchema.safeParse({
      fence_type: "vinyl",
      length: 150,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when fence_type missing", () => {
    const result = quoteFormSchema.safeParse({
      client_name: "John Doe",
      length: 150,
      height: 6,
      gates_standard: 0,
      gates_large: 0,
      remove_old: false,
      terrain: "flat",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// PROFILE VALIDATION
// ============================================================

describe("profileSchema", () => {
  const validProfile = {
    company_name: "Acme Fencing",
    phone: "+1234567890",
    email: "info@acmefencing.com",
    region: "US",
    currency: "USD",
    unit_system: "imperial",
  };

  it("accepts valid profile", () => {
    const result = profileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("requires company_name", () => {
    const result = profileSchema.safeParse({ ...validProfile, company_name: "" });
    expect(result.success).toBe(false);
  });

  it("requires phone", () => {
    const result = profileSchema.safeParse({ ...validProfile, phone: "" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid regions", () => {
    const regions = ["US", "CA", "UK", "AU", "EU", "Other"];

    for (const region of regions) {
      const result = profileSchema.safeParse({ ...validProfile, region });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid region", () => {
    const result = profileSchema.safeParse({ ...validProfile, region: "XX" });
    expect(result.success).toBe(false);
  });

  it("requires 3-char currency code", () => {
    const result = profileSchema.safeParse({ ...validProfile, currency: "US" });
    expect(result.success).toBe(false);
  });

  it("accepts both unit systems", () => {
    expect(profileSchema.safeParse({ ...validProfile, unit_system: "imperial" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...validProfile, unit_system: "metric" }).success).toBe(true);
  });
});

// ============================================================
// SETTINGS VALIDATION
// ============================================================

describe("settingsSchema", () => {
  const validSettings = {
    hourly_rate: 45,
    default_markup_percent: 20,
    tax_percent: 8,
    terms_template: "Quote valid for 30 days.",
  };

  it("accepts valid settings", () => {
    const result = settingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it("rejects zero hourly rate", () => {
    const result = settingsSchema.safeParse({ ...validSettings, hourly_rate: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative hourly rate", () => {
    const result = settingsSchema.safeParse({ ...validSettings, hourly_rate: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects hourly rate over 1000", () => {
    const result = settingsSchema.safeParse({ ...validSettings, hourly_rate: 1500 });
    expect(result.success).toBe(false);
  });

  it("accepts zero markup", () => {
    const result = settingsSchema.safeParse({ ...validSettings, default_markup_percent: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects negative markup", () => {
    const result = settingsSchema.safeParse({ ...validSettings, default_markup_percent: -5 });
    expect(result.success).toBe(false);
  });

  it("rejects markup over 100", () => {
    const result = settingsSchema.safeParse({ ...validSettings, default_markup_percent: 150 });
    expect(result.success).toBe(false);
  });

  it("accepts zero tax", () => {
    const result = settingsSchema.safeParse({ ...validSettings, tax_percent: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects tax over 50", () => {
    const result = settingsSchema.safeParse({ ...validSettings, tax_percent: 60 });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// ONBOARDING VALIDATION
// ============================================================

describe("onboardingSchema", () => {
  const validOnboarding = {
    company_name: "Acme Fencing",
    phone: "+1234567890",
    region: "US",
    currency: "USD",
    unit_system: "imperial",
    hourly_rate: 45,
    default_markup_percent: 20,
    tax_percent: 8,
  };

  it("accepts valid onboarding data", () => {
    const result = onboardingSchema.safeParse(validOnboarding);
    expect(result.success).toBe(true);
  });

  it("rejects when company_name missing", () => {
    const { company_name, ...rest } = validOnboarding;
    const result = onboardingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when hourly_rate missing", () => {
    const { hourly_rate, ...rest } = validOnboarding;
    const result = onboardingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ============================================================
// MATERIAL VALIDATION
// ============================================================

describe("materialSchema", () => {
  const validMaterial = {
    fence_type: "wood_privacy",
    name: "4x4 Post (8ft)",
    unit: "each",
    unit_price: 14.0,
    category: "post",
  };

  it("accepts valid material", () => {
    const result = materialSchema.safeParse(validMaterial);
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = materialSchema.safeParse({ ...validMaterial, name: "" });
    expect(result.success).toBe(false);
  });

  it("accepts zero price", () => {
    const result = materialSchema.safeParse({ ...validMaterial, unit_price: 0 });
    expect(result.success).toBe(true);
  });

  it("rejects negative price", () => {
    const result = materialSchema.safeParse({ ...validMaterial, unit_price: -5 });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// CUSTOM ITEM VALIDATION
// ============================================================

describe("customItemSchema", () => {
  it("accepts valid custom item", () => {
    const result = customItemSchema.safeParse({
      name: "Extra cleanup",
      qty: 2,
      unit_price: 75,
    });
    expect(result.success).toBe(true);
  });

  it("requires positive quantity", () => {
    const result = customItemSchema.safeParse({
      name: "Extra cleanup",
      qty: 0,
      unit_price: 75,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero price", () => {
    const result = customItemSchema.safeParse({
      name: "Free item",
      qty: 1,
      unit_price: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// AUTH VALIDATION
// ============================================================

describe("loginSchema", () => {
  it("accepts valid login", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("requires email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("validates email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("requires password at least 6 chars", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "12345",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid registration", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("requires password at least 8 chars", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "1234567",
      confirmPassword: "1234567",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      email: "user@example.com",
      password: "password123",
      confirmPassword: "password456",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("confirmPassword");
    }
  });
});

describe("resetPasswordSchema", () => {
  it("accepts valid email", () => {
    const result = resetPasswordSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("requires valid email", () => {
    const result = resetPasswordSchema.safeParse({
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// SEND VALIDATION
// ============================================================

describe("sendEmailSchema", () => {
  it("accepts valid email send request", () => {
    const result = sendEmailSchema.safeParse({
      to: "client@example.com",
      subject: "Your Fence Quote",
      message: "Please find your quote attached.",
    });
    expect(result.success).toBe(true);
  });

  it("requires valid to email", () => {
    const result = sendEmailSchema.safeParse({
      to: "not-an-email",
      subject: "Quote",
    });
    expect(result.success).toBe(false);
  });

  it("requires subject", () => {
    const result = sendEmailSchema.safeParse({
      to: "client@example.com",
      subject: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendSmsSchema", () => {
  it("accepts valid E.164 phone", () => {
    const result = sendSmsSchema.safeParse({
      to: "+14155551234",
      message: "Your quote is ready.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone without plus", () => {
    const result = sendSmsSchema.safeParse({
      to: "14155551234",
      message: "Your quote is ready.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid phone format", () => {
    const result = sendSmsSchema.safeParse({
      to: "555-1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone starting with 0", () => {
    const result = sendSmsSchema.safeParse({
      to: "04155551234",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

describe("validate helper", () => {
  it("returns success with data on valid input", () => {
    const result = validate(loginSchema, {
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("returns errors object on invalid input", () => {
    const result = validate(loginSchema, {
      email: "not-an-email",
      password: "123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
    }
  });
});

describe("validateOrThrow helper", () => {
  it("returns data on valid input", () => {
    const data = validateOrThrow(loginSchema, {
      email: "user@example.com",
      password: "password123",
    });

    expect(data.email).toBe("user@example.com");
  });

  it("throws on invalid input", () => {
    expect(() =>
      validateOrThrow(loginSchema, {
        email: "not-an-email",
        password: "123",
      })
    ).toThrow();
  });
});

describe("isValidEmail", () => {
  it("returns true for valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true);
  });

  it("returns false for invalid emails", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
    expect(isValidEmail("user@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("returns true for valid E.164 phones", () => {
    expect(isValidPhone("+14155551234")).toBe(true);
    expect(isValidPhone("14155551234")).toBe(true);
    expect(isValidPhone("+442071234567")).toBe(true);
  });

  it("returns false for invalid phones", () => {
    expect(isValidPhone("555-1234")).toBe(false);
    expect(isValidPhone("04155551234")).toBe(false);
    expect(isValidPhone("+1234")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("sanitize", () => {
  it("trims whitespace", () => {
    expect(sanitize("  hello  ")).toBe("hello");
    expect(sanitize("\n\ttext\n\t")).toBe("text");
  });

  it("handles null and undefined", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
  });
});

describe("parseNumber", () => {
  it("parses string numbers", () => {
    expect(parseNumber("123")).toBe(123);
    expect(parseNumber("45.67")).toBe(45.67);
  });

  it("returns number as-is", () => {
    expect(parseNumber(123)).toBe(123);
  });

  it("returns 0 for invalid input", () => {
    expect(parseNumber("not-a-number")).toBe(0);
    expect(parseNumber(null)).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
    expect(parseNumber("")).toBe(0);
  });
});

describe("parseInt", () => {
  it("parses string integers", () => {
    expect(parseInt("123")).toBe(123);
    expect(parseInt("45.67")).toBe(45);
  });

  it("floors number input", () => {
    expect(parseInt(45.9)).toBe(45);
  });

  it("returns 0 for invalid input", () => {
    expect(parseInt("not-a-number")).toBe(0);
    expect(parseInt(null)).toBe(0);
    expect(parseInt(undefined)).toBe(0);
  });
});
