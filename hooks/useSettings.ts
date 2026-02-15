// hooks/useSettings.ts
// Settings management hook — CLAUDE.md section 2

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Settings, SettingsUpdate } from "@/types/database";
import type { CalculatorSettings } from "@/types/quote";

type SettingsState = {
  isLoading: boolean;
  isSaving: boolean;
  settings: Settings | null;
  error: string | null;
};

type SettingsActions = {
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: SettingsUpdate) => Promise<{ error: string | null }>;
  updateHourlyRate: (rate: number) => Promise<{ error: string | null }>;
  updateMarkup: (percent: number) => Promise<{ error: string | null }>;
  updateTax: (percent: number) => Promise<{ error: string | null }>;
  updateTerms: (template: string) => Promise<{ error: string | null }>;
  resetToDefaults: (region?: string) => Promise<{ error: string | null }>;
};

export type UseSettingsReturn = SettingsState & SettingsActions;

export function useSettings(userId: string | null): UseSettingsReturn {
  const [state, setState] = useState<SettingsState>({
    isLoading: true,
    isSaving: false,
    settings: null,
    error: null,
  });

  // ============================================================
  // FETCH SETTINGS
  // ============================================================

  const fetchSettings = useCallback(async () => {
    if (!userId) {
      setState({
        isLoading: false,
        isSaving: false,
        settings: null,
        error: "Not authenticated",
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        // Settings might not exist yet (will be created by trigger on user creation)
        if (error.code === "PGRST116") {
          // No rows returned - create default settings
          const created = await createDefaultSettings(userId);
          if (created) {
            setState({
              isLoading: false,
              isSaving: false,
              settings: created,
              error: null,
            });
            return;
          }
        }

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      setState({
        isLoading: false,
        isSaving: false,
        settings: data as Settings,
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch settings",
      }));
    }
  }, [userId]);

  // Auto-fetch on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchSettings();
    } else {
      setState({
        isLoading: false,
        isSaving: false,
        settings: null,
        error: null,
      });
    }
  }, [userId, fetchSettings]);

  // ============================================================
  // UPDATE SETTINGS
  // ============================================================

  const updateSettings = useCallback(
    async (updates: SettingsUpdate): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { data, error } = await supabase
          .from("settings")
          .update(updates)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message };
        }

        setState((prev) => ({
          ...prev,
          isSaving: false,
          settings: data as Settings,
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to update settings";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // CONVENIENCE METHODS
  // ============================================================

  const updateHourlyRate = useCallback(
    async (rate: number): Promise<{ error: string | null }> => {
      if (rate < 0 || rate > 1000) {
        return { error: "Hourly rate must be between 0 and 1000" };
      }
      return updateSettings({ hourly_rate: rate });
    },
    [updateSettings]
  );

  const updateMarkup = useCallback(
    async (percent: number): Promise<{ error: string | null }> => {
      if (percent < 0 || percent > 100) {
        return { error: "Markup must be between 0% and 100%" };
      }
      return updateSettings({ default_markup_percent: percent });
    },
    [updateSettings]
  );

  const updateTax = useCallback(
    async (percent: number): Promise<{ error: string | null }> => {
      if (percent < 0 || percent > 50) {
        return { error: "Tax must be between 0% and 50%" };
      }
      return updateSettings({ tax_percent: percent });
    },
    [updateSettings]
  );

  const updateTerms = useCallback(
    async (template: string): Promise<{ error: string | null }> => {
      if (template.length > 5000) {
        return { error: "Terms template is too long (max 5000 characters)" };
      }
      return updateSettings({ terms_template: template });
    },
    [updateSettings]
  );

  // ============================================================
  // RESET TO DEFAULTS
  // ============================================================

  const resetToDefaults = useCallback(
    async (region?: string): Promise<{ error: string | null }> => {
      const { REGIONAL_DEFAULTS, DEFAULT_TERMS_TEMPLATE } = await import(
        "@/constants/defaults"
      );

      const regionCode = (region ?? "US") as keyof typeof REGIONAL_DEFAULTS;
      const defaults = REGIONAL_DEFAULTS[regionCode] ?? REGIONAL_DEFAULTS.US;

      return updateSettings({
        hourly_rate: defaults.hourly_rate,
        default_markup_percent: 20,
        tax_percent: 0,
        terms_template: DEFAULT_TERMS_TEMPLATE,
      });
    },
    [updateSettings]
  );

  return {
    ...state,
    fetchSettings,
    updateSettings,
    updateHourlyRate,
    updateMarkup,
    updateTax,
    updateTerms,
    resetToDefaults,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Create default settings for a user
 */
async function createDefaultSettings(userId: string): Promise<Settings | null> {
  try {
    const { DEFAULT_TERMS_TEMPLATE } = await import("@/constants/defaults");

    const { data, error } = await supabase
      .from("settings")
      .insert({
        user_id: userId,
        hourly_rate: 45,
        default_markup_percent: 20,
        tax_percent: 0,
        terms_template: DEFAULT_TERMS_TEMPLATE,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create default settings:", error);
      return null;
    }

    return data as Settings;
  } catch (e) {
    console.error("Failed to create default settings:", e);
    return null;
  }
}

/**
 * Get calculator settings from Settings object
 */
export function toCalculatorSettings(settings: Settings | null): CalculatorSettings {
  if (!settings) {
    return {
      hourly_rate: 45,
      default_markup_percent: 20,
      tax_percent: 0,
    };
  }

  return {
    hourly_rate: settings.hourly_rate,
    default_markup_percent: settings.default_markup_percent,
    tax_percent: settings.tax_percent,
  };
}

/**
 * Format hourly rate for display
 */
export function formatHourlyRate(
  settings: Settings | null,
  currencySymbol: string = "$"
): string {
  const rate = settings?.hourly_rate ?? 45;
  return `${currencySymbol}${rate.toFixed(2)}/hr`;
}

/**
 * Format markup percentage for display
 */
export function formatMarkup(settings: Settings | null): string {
  const markup = settings?.default_markup_percent ?? 20;
  return `${markup}%`;
}

/**
 * Format tax percentage for display
 */
export function formatTax(settings: Settings | null): string {
  const tax = settings?.tax_percent ?? 0;
  return tax > 0 ? `${tax}%` : "None";
}

/**
 * Check if settings have been customized from defaults
 */
export function areSettingsCustomized(settings: Settings | null): boolean {
  if (!settings) return false;

  return (
    settings.hourly_rate !== 45 ||
    settings.default_markup_percent !== 20 ||
    settings.tax_percent !== 0
  );
}

/**
 * Initialize settings for onboarding
 */
export async function initializeSettings(
  userId: string,
  region: string,
  hourlyRate: number,
  markupPercent: number,
  taxPercent: number
): Promise<{ error: string | null }> {
  try {
    const { DEFAULT_TERMS_TEMPLATE } = await import("@/constants/defaults");

    const { error } = await supabase.from("settings").upsert(
      {
        user_id: userId,
        hourly_rate: hourlyRate,
        default_markup_percent: markupPercent,
        tax_percent: taxPercent,
        terms_template: DEFAULT_TERMS_TEMPLATE,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to initialize settings" };
  }
}
