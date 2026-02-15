// hooks/useOfflineQuote.ts
// Offline quote draft management with AsyncStorage — CLAUDE.md section 2

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import type { QuoteInputs, QuoteVariant, VariantType } from "@/types/quote";

const STORAGE_KEY = "fencequoter_draft";
const AUTOSAVE_INTERVAL = 5000; // 5 seconds

export interface OfflineQuoteDraft {
  // Client info
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;

  // Quote inputs
  inputs: Partial<QuoteInputs>;

  // Calculated data (if any)
  variants?: QuoteVariant[];
  selected_variant?: VariantType;

  // Metadata
  savedAt: string;
  version: number;
}

const EMPTY_DRAFT: OfflineQuoteDraft = {
  client_name: "",
  client_email: "",
  client_phone: "",
  client_address: "",
  inputs: {
    fence_type: "wood_privacy",
    length: 0,
    height: 6,
    gates_standard: 0,
    gates_large: 0,
    remove_old: false,
    terrain: "flat",
    notes: "",
  },
  variants: undefined,
  selected_variant: undefined,
  savedAt: "",
  version: 1,
};

type OfflineQuoteState = {
  isLoading: boolean;
  isSaving: boolean;
  draft: OfflineQuoteDraft;
  hasDraft: boolean;
  lastSavedAt: string | null;
  error: string | null;
};

type OfflineQuoteActions = {
  loadDraft: () => Promise<void>;
  saveDraft: (draft: Partial<OfflineQuoteDraft>) => Promise<void>;
  updateField: <K extends keyof OfflineQuoteDraft>(
    field: K,
    value: OfflineQuoteDraft[K]
  ) => void;
  updateInput: <K extends keyof QuoteInputs>(field: K, value: QuoteInputs[K]) => void;
  updateClientInfo: (info: Partial<Pick<OfflineQuoteDraft, "client_name" | "client_email" | "client_phone" | "client_address">>) => void;
  setCalculatedVariants: (variants: QuoteVariant[], selected?: VariantType) => void;
  clearDraft: () => Promise<void>;
  getDraftForSubmit: () => OfflineQuoteDraft;
};

export type UseOfflineQuoteReturn = OfflineQuoteState & OfflineQuoteActions;

export function useOfflineQuote(): UseOfflineQuoteReturn {
  const [state, setState] = useState<OfflineQuoteState>({
    isLoading: true,
    isSaving: false,
    draft: { ...EMPTY_DRAFT },
    hasDraft: false,
    lastSavedAt: null,
    error: null,
  });

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<OfflineQuoteDraft | null>(null);

  // ============================================================
  // LOAD DRAFT FROM STORAGE
  // ============================================================

  const loadDraft = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed = JSON.parse(stored) as OfflineQuoteDraft;

        // Validate and migrate if needed
        const draft = migrateDraft(parsed);

        setState({
          isLoading: false,
          isSaving: false,
          draft,
          hasDraft: isDraftNotEmpty(draft),
          lastSavedAt: draft.savedAt || null,
          error: null,
        });
      } else {
        setState({
          isLoading: false,
          isSaving: false,
          draft: { ...EMPTY_DRAFT },
          hasDraft: false,
          lastSavedAt: null,
          error: null,
        });
      }
    } catch (e) {
      console.error("Failed to load draft:", e);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to load saved draft",
      }));
    }
  }, []);

  // Load on mount
  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  // ============================================================
  // SAVE DRAFT TO STORAGE
  // ============================================================

  const saveDraft = useCallback(async (updates: Partial<OfflineQuoteDraft>) => {
    setState((prev) => {
      const newDraft: OfflineQuoteDraft = {
        ...prev.draft,
        ...updates,
        savedAt: new Date().toISOString(),
        version: (prev.draft.version ?? 0) + 1,
      };

      // Store for async save
      pendingDraftRef.current = newDraft;

      return {
        ...prev,
        draft: newDraft,
        hasDraft: isDraftNotEmpty(newDraft),
        isSaving: true,
      };
    });

    // Debounced save to storage
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        if (pendingDraftRef.current) {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(pendingDraftRef.current)
          );

          setState((prev) => ({
            ...prev,
            isSaving: false,
            lastSavedAt: pendingDraftRef.current?.savedAt ?? null,
          }));
        }
      } catch (e) {
        console.error("Failed to save draft:", e);
        setState((prev) => ({
          ...prev,
          isSaving: false,
          error: "Failed to save draft",
        }));
      }
    }, 500); // Debounce 500ms
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================
  // UPDATE HELPERS
  // ============================================================

  const updateField = useCallback(
    <K extends keyof OfflineQuoteDraft>(field: K, value: OfflineQuoteDraft[K]) => {
      saveDraft({ [field]: value });
    },
    [saveDraft]
  );

  const updateInput = useCallback(
    <K extends keyof QuoteInputs>(field: K, value: QuoteInputs[K]) => {
      setState((prev) => {
        const newInputs = {
          ...prev.draft.inputs,
          [field]: value,
        };

        const newDraft: OfflineQuoteDraft = {
          ...prev.draft,
          inputs: newInputs,
          // Clear calculated variants when inputs change
          variants: undefined,
          selected_variant: undefined,
        };

        pendingDraftRef.current = {
          ...newDraft,
          savedAt: new Date().toISOString(),
          version: (prev.draft.version ?? 0) + 1,
        };

        return {
          ...prev,
          draft: pendingDraftRef.current,
          hasDraft: isDraftNotEmpty(pendingDraftRef.current),
          isSaving: true,
        };
      });

      // Debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (pendingDraftRef.current) {
            await AsyncStorage.setItem(
              STORAGE_KEY,
              JSON.stringify(pendingDraftRef.current)
            );

            setState((prev) => ({
              ...prev,
              isSaving: false,
              lastSavedAt: pendingDraftRef.current?.savedAt ?? null,
            }));
          }
        } catch (e) {
          console.error("Failed to save draft:", e);
        }
      }, 500);
    },
    []
  );

  const updateClientInfo = useCallback(
    (
      info: Partial<
        Pick<
          OfflineQuoteDraft,
          "client_name" | "client_email" | "client_phone" | "client_address"
        >
      >
    ) => {
      saveDraft(info);
    },
    [saveDraft]
  );

  const setCalculatedVariants = useCallback(
    (variants: QuoteVariant[], selected?: VariantType) => {
      saveDraft({
        variants,
        selected_variant: selected ?? "standard",
      });
    },
    [saveDraft]
  );

  // ============================================================
  // CLEAR DRAFT
  // ============================================================

  const clearDraft = useCallback(async () => {
    setState((prev) => ({ ...prev, isSaving: true }));

    try {
      await AsyncStorage.removeItem(STORAGE_KEY);

      setState({
        isLoading: false,
        isSaving: false,
        draft: { ...EMPTY_DRAFT },
        hasDraft: false,
        lastSavedAt: null,
        error: null,
      });
    } catch (e) {
      console.error("Failed to clear draft:", e);
      setState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Failed to clear draft",
      }));
    }
  }, []);

  // ============================================================
  // GET DRAFT FOR SUBMIT
  // ============================================================

  const getDraftForSubmit = useCallback((): OfflineQuoteDraft => {
    return { ...state.draft };
  }, [state.draft]);

  return {
    ...state,
    loadDraft,
    saveDraft,
    updateField,
    updateInput,
    updateClientInfo,
    setCalculatedVariants,
    clearDraft,
    getDraftForSubmit,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if draft has meaningful data
 */
function isDraftNotEmpty(draft: OfflineQuoteDraft): boolean {
  return (
    (draft.client_name?.trim().length ?? 0) > 0 ||
    (draft.inputs?.length ?? 0) > 0 ||
    (draft.inputs?.fence_type && draft.inputs.fence_type !== "wood_privacy") ||
    (draft.inputs?.gates_standard ?? 0) > 0 ||
    (draft.inputs?.gates_large ?? 0) > 0 ||
    draft.inputs?.remove_old === true
  );
}

/**
 * Migrate old draft versions
 */
function migrateDraft(draft: Partial<OfflineQuoteDraft>): OfflineQuoteDraft {
  return {
    client_name: draft.client_name ?? "",
    client_email: draft.client_email ?? "",
    client_phone: draft.client_phone ?? "",
    client_address: draft.client_address ?? "",
    inputs: {
      fence_type: draft.inputs?.fence_type ?? "wood_privacy",
      length: draft.inputs?.length ?? 0,
      height: draft.inputs?.height ?? 6,
      gates_standard: draft.inputs?.gates_standard ?? 0,
      gates_large: draft.inputs?.gates_large ?? 0,
      remove_old: draft.inputs?.remove_old ?? false,
      terrain: draft.inputs?.terrain ?? "flat",
      notes: draft.inputs?.notes ?? "",
    },
    variants: draft.variants,
    selected_variant: draft.selected_variant,
    savedAt: draft.savedAt ?? "",
    version: draft.version ?? 1,
  };
}

/**
 * Format last saved time for display
 */
export function formatLastSaved(savedAt: string | null): string {
  if (!savedAt) return "";

  try {
    const date = new Date(savedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 10) {
      return "Saved just now";
    }
    if (diffSec < 60) {
      return `Saved ${diffSec}s ago`;
    }
    if (diffMin < 60) {
      return `Saved ${diffMin}m ago`;
    }

    return `Saved at ${date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  } catch {
    return "Saved";
  }
}

/**
 * Check if draft is ready for calculation
 */
export function isDraftReadyForCalculation(draft: OfflineQuoteDraft): boolean {
  return (
    (draft.client_name?.trim().length ?? 0) > 0 &&
    (draft.inputs?.length ?? 0) > 0 &&
    !!draft.inputs?.fence_type &&
    (draft.inputs?.height ?? 0) > 0
  );
}

/**
 * Get validation errors for draft
 */
export function getDraftValidationErrors(
  draft: OfflineQuoteDraft
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!draft.client_name?.trim()) {
    errors.client_name = "Client name is required";
  }

  if (!draft.inputs?.fence_type) {
    errors.fence_type = "Please select a fence type";
  }

  if (!draft.inputs?.length || draft.inputs.length <= 0) {
    errors.length = "Fence length is required";
  }

  if (!draft.inputs?.height || draft.inputs.height <= 0) {
    errors.height = "Fence height is required";
  }

  if (draft.client_email && !isValidEmail(draft.client_email)) {
    errors.client_email = "Invalid email address";
  }

  return errors;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Create QuoteInputs from draft
 */
export function draftToQuoteInputs(draft: OfflineQuoteDraft): QuoteInputs {
  return {
    fence_type: draft.inputs?.fence_type ?? "wood_privacy",
    length: draft.inputs?.length ?? 0,
    height: draft.inputs?.height ?? 6,
    gates_standard: draft.inputs?.gates_standard ?? 0,
    gates_large: draft.inputs?.gates_large ?? 0,
    remove_old: draft.inputs?.remove_old ?? false,
    terrain: draft.inputs?.terrain ?? "flat",
    notes: draft.inputs?.notes,
  };
}
