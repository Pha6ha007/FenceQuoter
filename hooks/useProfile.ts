// hooks/useProfile.ts
// Profile management hook — CLAUDE.md section 2

import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import { logoPath, publicLogoUrl, uploadImageToBucket } from "@/lib/storage";
import type { Profile, ProfileUpdate } from "@/types/database";
import type { RegionCode, UnitSystem } from "@/types/quote";

type ProfileState = {
  isLoading: boolean;
  isSaving: boolean;
  profile: Profile | null;
  error: string | null;
};

type ProfileActions = {
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<{ error: string | null }>;
  uploadLogo: (imageUri: string) => Promise<{ error: string | null; url: string | null }>;
  removeLogo: () => Promise<{ error: string | null }>;
  setRegion: (region: RegionCode) => Promise<{ error: string | null }>;
};

export type UseProfileReturn = ProfileState & ProfileActions;

export function useProfile(userId: string | null): UseProfileReturn {
  const [state, setState] = useState<ProfileState>({
    isLoading: true,
    isSaving: false,
    profile: null,
    error: null,
  });

  // ============================================================
  // FETCH PROFILE
  // ============================================================

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setState({
        isLoading: false,
        isSaving: false,
        profile: null,
        error: "Not authenticated",
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
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
        profile: data as Profile,
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch profile",
      }));
    }
  }, [userId]);

  // Auto-fetch on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setState({
        isLoading: false,
        isSaving: false,
        profile: null,
        error: null,
      });
    }
  }, [userId, fetchProfile]);

  // ============================================================
  // UPDATE PROFILE
  // ============================================================

  const updateProfile = useCallback(
    async (updates: ProfileUpdate): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { data, error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", userId)
          .select()
          .single();

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message };
        }

        setState((prev) => ({
          ...prev,
          isSaving: false,
          profile: data as Profile,
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to update profile";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // UPLOAD LOGO
  // ============================================================

  const uploadLogo = useCallback(
    async (imageUri: string): Promise<{ error: string | null; url: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated", url: null };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        // Determine file extension from URI
        const ext = imageUri.toLowerCase().includes(".png") ? "png" : "jpg";
        const path = logoPath(userId, ext);

        // Upload to storage
        await uploadImageToBucket({
          supabase,
          bucket: "logos",
          path,
          uri: imageUri,
          upsert: true,
        });

        // Get public URL
        const url = publicLogoUrl(supabase, path);

        // Update profile with new logo URL
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ logo_url: url })
          .eq("id", userId);

        if (updateError) {
          setState((prev) => ({ ...prev, isSaving: false, error: updateError.message }));
          return { error: updateError.message, url: null };
        }

        // Update local state
        setState((prev) => ({
          ...prev,
          isSaving: false,
          profile: prev.profile ? { ...prev.profile, logo_url: url } : null,
          error: null,
        }));

        return { error: null, url };
      } catch (e: unknown) {
        const errorMsg = e instanceof Error ? e.message : "Failed to upload logo";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg, url: null };
      }
    },
    [userId]
  );

  // ============================================================
  // REMOVE LOGO
  // ============================================================

  const removeLogo = useCallback(async (): Promise<{ error: string | null }> => {
    if (!userId) {
      return { error: "Not authenticated" };
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      // Update profile to remove logo URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ logo_url: null })
        .eq("id", userId);

      if (updateError) {
        setState((prev) => ({ ...prev, isSaving: false, error: updateError.message }));
        return { error: updateError.message };
      }

      // Optionally delete from storage (logos bucket)
      // Note: We could keep old logos for history, or delete them
      // For now, we just clear the reference

      // Update local state
      setState((prev) => ({
        ...prev,
        isSaving: false,
        profile: prev.profile ? { ...prev.profile, logo_url: null } : null,
        error: null,
      }));

      return { error: null };
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Failed to remove logo";
      setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
      return { error: errorMsg };
    }
  }, [userId]);

  // ============================================================
  // SET REGION (convenience method)
  // ============================================================

  const setRegion = useCallback(
    async (region: RegionCode): Promise<{ error: string | null }> => {
      // Import regional defaults
      const { REGIONAL_DEFAULTS } = await import("@/constants/defaults");
      const defaults = REGIONAL_DEFAULTS[region];

      return updateProfile({
        region,
        currency: defaults.currency,
        unit_system: defaults.unit_system as UnitSystem,
      });
    },
    [updateProfile]
  );

  return {
    ...state,
    fetchProfile,
    updateProfile,
    uploadLogo,
    removeLogo,
    setRegion,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if profile is complete (has required fields for operation)
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;

  return Boolean(
    profile.company_name &&
      profile.company_name.trim().length > 0 &&
      profile.phone &&
      profile.phone.trim().length > 0
  );
}

/**
 * Get display name for profile (company name or fallback)
 */
export function getProfileDisplayName(profile: Profile | null): string {
  if (!profile) return "My Company";
  return profile.company_name?.trim() || "My Company";
}

/**
 * Get currency symbol for profile
 */
export function getProfileCurrencySymbol(profile: Profile | null): string {
  if (!profile) return "$";

  const symbols: Record<string, string> = {
    USD: "$",
    CAD: "C$",
    GBP: "£",
    EUR: "€",
    AUD: "A$",
  };

  return symbols[profile.currency] ?? "$";
}

/**
 * Get unit label based on profile's unit system
 */
export function getUnitLabel(
  profile: Profile | null,
  type: "length" | "height"
): string {
  const isMetric = profile?.unit_system === "metric";

  if (type === "length") {
    return isMetric ? "m" : "ft";
  }

  return isMetric ? "m" : "ft";
}

/**
 * Create initial profile for new user
 */
export async function createInitialProfile(
  userId: string,
  email: string | null,
  region: RegionCode = "US"
): Promise<{ error: string | null }> {
  try {
    const { REGIONAL_DEFAULTS } = await import("@/constants/defaults");
    const defaults = REGIONAL_DEFAULTS[region];

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: email ?? "",
        company_name: "",
        phone: "",
        logo_url: null,
        region,
        currency: defaults.currency,
        unit_system: defaults.unit_system,
      },
      { onConflict: "id" }
    );

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "Failed to create profile" };
  }
}
