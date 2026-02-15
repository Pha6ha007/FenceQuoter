// lib/validation.ts
// Zod validation schemas — CLAUDE.md section 2

import { z } from "zod";

// ============================================================
// PRIMITIVE SCHEMAS
// ============================================================

export const fenceTypeSchema = z.enum([
  "wood_privacy",
  "wood_picket",
  "chain_link",
  "vinyl",
  "aluminum",
]);

export const terrainTypeSchema = z.enum([
  "flat",
  "slight_slope",
  "steep_slope",
  "rocky",
]);

export const variantTypeSchema = z.enum(["budget", "standard", "premium"]);

export const quoteStatusSchema = z.enum([
  "draft",
  "calculated",
  "sent",
  "accepted",
  "rejected",
]);

export const unitSystemSchema = z.enum(["imperial", "metric"]);

export const regionCodeSchema = z.enum(["US", "CA", "UK", "AU", "EU", "Other"]);

// ============================================================
// QUOTE INPUT VALIDATION
// ============================================================

export const quoteInputsSchema = z.object({
  fence_type: fenceTypeSchema,
  length: z
    .number()
    .positive("Length must be greater than 0")
    .max(10000, "Length seems too large"),
  height: z
    .number()
    .positive("Height must be greater than 0")
    .max(20, "Height seems too large"),
  gates_standard: z
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(50, "Too many gates"),
  gates_large: z
    .number()
    .int()
    .min(0, "Cannot be negative")
    .max(20, "Too many gates"),
  remove_old: z.boolean(),
  terrain: terrainTypeSchema,
  notes: z.string().max(2000, "Notes too long").optional(),
});

export type QuoteInputsValidated = z.infer<typeof quoteInputsSchema>;

// ============================================================
// CLIENT INFO VALIDATION
// ============================================================

export const clientInfoSchema = z.object({
  client_name: z
    .string()
    .min(1, "Client name is required")
    .max(200, "Name too long"),
  client_email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email too long")
    .optional()
    .or(z.literal("")),
  client_phone: z
    .string()
    .max(30, "Phone number too long")
    .optional()
    .or(z.literal("")),
  client_address: z
    .string()
    .max(500, "Address too long")
    .optional()
    .or(z.literal("")),
});

export type ClientInfoValidated = z.infer<typeof clientInfoSchema>;

// Combined quote form (client + inputs)
export const quoteFormSchema = clientInfoSchema.merge(quoteInputsSchema);

export type QuoteFormValidated = z.infer<typeof quoteFormSchema>;

// ============================================================
// PROFILE / ONBOARDING VALIDATION
// ============================================================

export const profileSchema = z.object({
  company_name: z
    .string()
    .min(1, "Company name is required")
    .max(200, "Company name too long"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(30, "Phone number too long"),
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email too long")
    .optional()
    .or(z.literal("")),
  logo_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  region: regionCodeSchema,
  currency: z.string().length(3, "Currency must be 3 characters"),
  unit_system: unitSystemSchema,
});

export type ProfileValidated = z.infer<typeof profileSchema>;

// Onboarding form (profile + settings combined)
export const onboardingSchema = z.object({
  // Profile fields
  company_name: z
    .string()
    .min(1, "Company name is required")
    .max(200, "Company name too long"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .max(30, "Phone number too long"),
  region: regionCodeSchema,
  currency: z.string().length(3, "Currency must be 3 characters"),
  unit_system: unitSystemSchema,

  // Settings fields
  hourly_rate: z
    .number()
    .positive("Hourly rate must be greater than 0")
    .max(1000, "Hourly rate seems too high"),
  default_markup_percent: z
    .number()
    .min(0, "Markup cannot be negative")
    .max(100, "Markup cannot exceed 100%"),
  tax_percent: z
    .number()
    .min(0, "Tax cannot be negative")
    .max(50, "Tax rate seems too high"),
});

export type OnboardingValidated = z.infer<typeof onboardingSchema>;

// ============================================================
// SETTINGS VALIDATION
// ============================================================

export const settingsSchema = z.object({
  hourly_rate: z
    .number()
    .positive("Hourly rate must be greater than 0")
    .max(1000, "Hourly rate seems too high"),
  default_markup_percent: z
    .number()
    .min(0, "Markup cannot be negative")
    .max(100, "Markup cannot exceed 100%"),
  tax_percent: z
    .number()
    .min(0, "Tax cannot be negative")
    .max(50, "Tax rate seems too high"),
  terms_template: z.string().max(5000, "Terms too long").optional(),
});

export type SettingsValidated = z.infer<typeof settingsSchema>;

// ============================================================
// MATERIAL VALIDATION
// ============================================================

export const materialSchema = z.object({
  fence_type: fenceTypeSchema,
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  unit: z.string().min(1, "Unit is required").max(20, "Unit too long"),
  unit_price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100000, "Price seems too high"),
  category: z.string().min(1, "Category is required"),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type MaterialValidated = z.infer<typeof materialSchema>;

// ============================================================
// CUSTOM ITEM VALIDATION
// ============================================================

export const customItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  qty: z.number().positive("Quantity must be greater than 0").max(10000),
  unit_price: z
    .number()
    .min(0, "Price cannot be negative")
    .max(100000, "Price seems too high"),
});

export type CustomItemValidated = z.infer<typeof customItemSchema>;

// ============================================================
// AUTH VALIDATION
// ============================================================

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(254, "Email too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password too long"),
});

export type LoginValidated = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email address")
      .max(254, "Email too long"),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password too long"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterValidated = z.infer<typeof registerSchema>;

export const resetPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Invalid email address")
    .max(254, "Email too long"),
});

export type ResetPasswordValidated = z.infer<typeof resetPasswordSchema>;

// ============================================================
// SEND VALIDATION
// ============================================================

export const sendEmailSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required").max(200, "Subject too long"),
  message: z.string().max(5000, "Message too long").optional(),
});

export type SendEmailValidated = z.infer<typeof sendEmailSchema>;

export const sendSmsSchema = z.object({
  to: z
    .string()
    .min(1, "Phone is required")
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number (use E.164 format)"),
  message: z.string().max(1600, "SMS too long").optional(),
});

export type SendSmsValidated = z.infer<typeof sendSmsSchema>;

// ============================================================
// VALIDATION HELPERS
// ============================================================

/**
 * Validate data and return result with errors
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return { success: false, errors };
}

/**
 * Validate and throw on error
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Check if email is valid
 */
export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

/**
 * Check if phone is valid E.164 format
 */
export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(phone);
}

/**
 * Sanitize string input (trim whitespace)
 */
export function sanitize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/**
 * Parse number from string input
 */
export function parseNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parse integer from string input
 */
export function parseInt(value: string | number | null | undefined): number {
  if (typeof value === "number") return Math.floor(value);
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
