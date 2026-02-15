// hooks/useQuotes.ts
// Quotes management hook — CLAUDE.md section 2

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Quote, QuoteInsert, QuoteUpdate } from "@/types/database";
import type {
  CustomItem,
  QuoteInputs,
  QuoteStatus,
  QuoteVariant,
  VariantType,
} from "@/types/quote";

type QuotesState = {
  isLoading: boolean;
  isSaving: boolean;
  quotes: Quote[];
  error: string | null;
};

type QuotesFilter = {
  status?: QuoteStatus | "all";
  limit?: number;
  offset?: number;
};

type QuotesActions = {
  fetchQuotes: (filter?: QuotesFilter) => Promise<void>;
  fetchQuoteById: (id: string) => Promise<Quote | null>;
  createQuote: (quote: CreateQuoteParams) => Promise<{ error: string | null; id: string | null }>;
  updateQuote: (id: string, updates: QuoteUpdate) => Promise<{ error: string | null }>;
  deleteQuote: (id: string) => Promise<{ error: string | null }>;
  saveCalculatedQuote: (params: SaveCalculatedQuoteParams) => Promise<{ error: string | null; id: string | null }>;
  selectVariant: (id: string, variant: VariantType) => Promise<{ error: string | null }>;
  addCustomItem: (id: string, item: CustomItem) => Promise<{ error: string | null }>;
  removeCustomItem: (id: string, itemIndex: number) => Promise<{ error: string | null }>;
  updateStatus: (id: string, status: QuoteStatus) => Promise<{ error: string | null }>;
  markAsSent: (id: string, via: "email" | "sms") => Promise<{ error: string | null }>;
  duplicateQuote: (id: string) => Promise<{ error: string | null; newId: string | null }>;
};

export type UseQuotesReturn = QuotesState & QuotesActions;

export interface CreateQuoteParams {
  client_name: string;
  client_email?: string | null;
  client_phone?: string | null;
  client_address?: string | null;
  inputs: QuoteInputs;
}

export interface SaveCalculatedQuoteParams extends CreateQuoteParams {
  variants: QuoteVariant[];
  selected_variant?: VariantType;
}

export function useQuotes(userId: string | null): UseQuotesReturn {
  const [state, setState] = useState<QuotesState>({
    isLoading: true,
    isSaving: false,
    quotes: [],
    error: null,
  });

  // ============================================================
  // FETCH QUOTES
  // ============================================================

  const fetchQuotes = useCallback(
    async (filter?: QuotesFilter) => {
      if (!userId) {
        setState({
          isLoading: false,
          isSaving: false,
          quotes: [],
          error: "Not authenticated",
        });
        return;
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        let query = supabase
          .from("quotes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        // Apply status filter
        if (filter?.status && filter.status !== "all") {
          query = query.eq("status", filter.status);
        }

        // Apply pagination
        if (filter?.limit) {
          query = query.limit(filter.limit);
        }
        if (filter?.offset) {
          query = query.range(filter.offset, filter.offset + (filter.limit ?? 50) - 1);
        }

        const { data, error } = await query;

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
          quotes: (data ?? []) as Quote[],
          error: null,
        });
      } catch (e) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Failed to fetch quotes",
        }));
      }
    },
    [userId]
  );

  // Auto-fetch on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchQuotes();
    } else {
      setState({
        isLoading: false,
        isSaving: false,
        quotes: [],
        error: null,
      });
    }
  }, [userId, fetchQuotes]);

  // ============================================================
  // FETCH SINGLE QUOTE
  // ============================================================

  const fetchQuoteById = useCallback(
    async (id: string): Promise<Quote | null> => {
      if (!userId) return null;

      try {
        const { data, error } = await supabase
          .from("quotes")
          .select("*")
          .eq("id", id)
          .eq("user_id", userId)
          .single();

        if (error) {
          console.error("Failed to fetch quote:", error);
          return null;
        }

        return data as Quote;
      } catch (e) {
        console.error("Failed to fetch quote:", e);
        return null;
      }
    },
    [userId]
  );

  // ============================================================
  // CREATE QUOTE (draft)
  // ============================================================

  const createQuote = useCallback(
    async (
      params: CreateQuoteParams
    ): Promise<{ error: string | null; id: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated", id: null };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const quoteData: QuoteInsert = {
          user_id: userId,
          client_name: params.client_name,
          client_email: params.client_email ?? null,
          client_phone: params.client_phone ?? null,
          client_address: params.client_address ?? null,
          status: "draft",
          inputs: params.inputs,
          variants: [],
          selected_variant: "standard",
          custom_items: [],
          subtotal: 0,
          markup_amount: 0,
          tax_amount: 0,
          total: 0,
          pdf_url: null,
          sent_via: null,
          sent_at: null,
        };

        const { data, error } = await supabase
          .from("quotes")
          .insert(quoteData)
          .select()
          .single();

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message, id: null };
        }

        // Add to local state
        setState((prev) => ({
          ...prev,
          isSaving: false,
          quotes: [data as Quote, ...prev.quotes],
          error: null,
        }));

        return { error: null, id: data.id };
      } catch (e) {
        const errorMsg = "Failed to create quote";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg, id: null };
      }
    },
    [userId]
  );

  // ============================================================
  // SAVE CALCULATED QUOTE
  // ============================================================

  const saveCalculatedQuote = useCallback(
    async (
      params: SaveCalculatedQuoteParams
    ): Promise<{ error: string | null; id: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated", id: null };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const selectedVariant = params.selected_variant ?? "standard";
        const variant = params.variants.find((v) => v.type === selectedVariant);

        const quoteData: QuoteInsert = {
          user_id: userId,
          client_name: params.client_name,
          client_email: params.client_email ?? null,
          client_phone: params.client_phone ?? null,
          client_address: params.client_address ?? null,
          status: "calculated",
          inputs: params.inputs,
          variants: params.variants,
          selected_variant: selectedVariant,
          custom_items: [],
          subtotal: variant?.subtotal ?? 0,
          markup_amount: variant?.markup_amount ?? 0,
          tax_amount: variant?.tax_amount ?? 0,
          total: variant?.total ?? 0,
          pdf_url: null,
          sent_via: null,
          sent_at: null,
        };

        const { data, error } = await supabase
          .from("quotes")
          .insert(quoteData)
          .select()
          .single();

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message, id: null };
        }

        // Add to local state
        setState((prev) => ({
          ...prev,
          isSaving: false,
          quotes: [data as Quote, ...prev.quotes],
          error: null,
        }));

        return { error: null, id: data.id };
      } catch (e) {
        const errorMsg = "Failed to save quote";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg, id: null };
      }
    },
    [userId]
  );

  // ============================================================
  // UPDATE QUOTE
  // ============================================================

  const updateQuote = useCallback(
    async (id: string, updates: QuoteUpdate): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { data, error } = await supabase
          .from("quotes")
          .update(updates)
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message };
        }

        // Update local state
        setState((prev) => ({
          ...prev,
          isSaving: false,
          quotes: prev.quotes.map((q) => (q.id === id ? (data as Quote) : q)),
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to update quote";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // DELETE QUOTE
  // ============================================================

  const deleteQuote = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { error } = await supabase
          .from("quotes")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (error) {
          setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
          return { error: error.message };
        }

        // Remove from local state
        setState((prev) => ({
          ...prev,
          isSaving: false,
          quotes: prev.quotes.filter((q) => q.id !== id),
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to delete quote";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // SELECT VARIANT
  // ============================================================

  const selectVariant = useCallback(
    async (id: string, variant: VariantType): Promise<{ error: string | null }> => {
      // Find the quote to get variant totals
      const quote = state.quotes.find((q) => q.id === id);
      if (!quote) {
        return { error: "Quote not found" };
      }

      const selectedVariantData = quote.variants.find((v) => v.type === variant);
      if (!selectedVariantData) {
        return { error: "Variant not found" };
      }

      return updateQuote(id, {
        selected_variant: variant,
        subtotal: selectedVariantData.subtotal,
        markup_amount: selectedVariantData.markup_amount,
        tax_amount: selectedVariantData.tax_amount,
        total: selectedVariantData.total,
      });
    },
    [state.quotes, updateQuote]
  );

  // ============================================================
  // ADD CUSTOM ITEM
  // ============================================================

  const addCustomItem = useCallback(
    async (id: string, item: CustomItem): Promise<{ error: string | null }> => {
      const quote = state.quotes.find((q) => q.id === id);
      if (!quote) {
        return { error: "Quote not found" };
      }

      const newCustomItems = [...(quote.custom_items ?? []), item];

      // Recalculate total with custom items
      const customTotal = newCustomItems.reduce((sum, i) => sum + i.total, 0);
      const selectedVariant = quote.variants.find(
        (v) => v.type === quote.selected_variant
      );

      if (!selectedVariant) {
        return { error: "Selected variant not found" };
      }

      const newSubtotal = selectedVariant.subtotal + customTotal;
      const newMarkup = newSubtotal * (selectedVariant.markup_percent / 100);
      const newTax = (newSubtotal + newMarkup) * (quote.variants[0]?.tax_amount > 0 ? 0.08 : 0); // Approximate
      const newTotal = newSubtotal + newMarkup + newTax;

      return updateQuote(id, {
        custom_items: newCustomItems,
        subtotal: newSubtotal,
        markup_amount: newMarkup,
        tax_amount: newTax,
        total: newTotal,
      });
    },
    [state.quotes, updateQuote]
  );

  // ============================================================
  // REMOVE CUSTOM ITEM
  // ============================================================

  const removeCustomItem = useCallback(
    async (id: string, itemIndex: number): Promise<{ error: string | null }> => {
      const quote = state.quotes.find((q) => q.id === id);
      if (!quote) {
        return { error: "Quote not found" };
      }

      const newCustomItems = quote.custom_items.filter((_, i) => i !== itemIndex);

      // Recalculate total
      const customTotal = newCustomItems.reduce((sum, i) => sum + i.total, 0);
      const selectedVariant = quote.variants.find(
        (v) => v.type === quote.selected_variant
      );

      if (!selectedVariant) {
        return { error: "Selected variant not found" };
      }

      const baseSubtotal = selectedVariant.materials_total + selectedVariant.labor_total;
      const newSubtotal = baseSubtotal + customTotal;
      const newMarkup = newSubtotal * (selectedVariant.markup_percent / 100);
      const taxRate = selectedVariant.tax_amount / (selectedVariant.subtotal + selectedVariant.markup_amount) || 0;
      const newTax = (newSubtotal + newMarkup) * taxRate;
      const newTotal = newSubtotal + newMarkup + newTax;

      return updateQuote(id, {
        custom_items: newCustomItems,
        subtotal: newSubtotal,
        markup_amount: newMarkup,
        tax_amount: newTax,
        total: newTotal,
      });
    },
    [state.quotes, updateQuote]
  );

  // ============================================================
  // UPDATE STATUS
  // ============================================================

  const updateStatus = useCallback(
    async (id: string, status: QuoteStatus): Promise<{ error: string | null }> => {
      return updateQuote(id, { status });
    },
    [updateQuote]
  );

  // ============================================================
  // MARK AS SENT
  // ============================================================

  const markAsSent = useCallback(
    async (id: string, via: "email" | "sms"): Promise<{ error: string | null }> => {
      return updateQuote(id, {
        status: "sent",
        sent_via: via,
        sent_at: new Date().toISOString(),
      });
    },
    [updateQuote]
  );

  // ============================================================
  // DUPLICATE QUOTE
  // ============================================================

  const duplicateQuote = useCallback(
    async (id: string): Promise<{ error: string | null; newId: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated", newId: null };
      }

      const quote = state.quotes.find((q) => q.id === id);
      if (!quote) {
        // Try to fetch it
        const fetched = await fetchQuoteById(id);
        if (!fetched) {
          return { error: "Quote not found", newId: null };
        }
        return duplicateQuoteData(fetched);
      }

      return duplicateQuoteData(quote);

      async function duplicateQuoteData(
        source: Quote
      ): Promise<{ error: string | null; newId: string | null }> {
        setState((prev) => ({ ...prev, isSaving: true, error: null }));

        try {
          const newQuote: QuoteInsert = {
            user_id: userId!,
            client_name: source.client_name,
            client_email: source.client_email,
            client_phone: source.client_phone,
            client_address: source.client_address,
            status: "draft",
            inputs: source.inputs,
            variants: source.variants,
            selected_variant: source.selected_variant,
            custom_items: [],
            subtotal: source.subtotal,
            markup_amount: source.markup_amount,
            tax_amount: source.tax_amount,
            total: source.total,
            pdf_url: null,
            sent_via: null,
            sent_at: null,
          };

          const { data, error } = await supabase
            .from("quotes")
            .insert(newQuote)
            .select()
            .single();

          if (error) {
            setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
            return { error: error.message, newId: null };
          }

          // Add to local state
          setState((prev) => ({
            ...prev,
            isSaving: false,
            quotes: [data as Quote, ...prev.quotes],
            error: null,
          }));

          return { error: null, newId: data.id };
        } catch (e) {
          const errorMsg = "Failed to duplicate quote";
          setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
          return { error: errorMsg, newId: null };
        }
      }
    },
    [userId, state.quotes, fetchQuoteById]
  );

  return {
    ...state,
    fetchQuotes,
    fetchQuoteById,
    createQuote,
    updateQuote,
    deleteQuote,
    saveCalculatedQuote,
    selectVariant,
    addCustomItem,
    removeCustomItem,
    updateStatus,
    markAsSent,
    duplicateQuote,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Filter quotes by status
 */
export function filterByStatus(quotes: Quote[], status: QuoteStatus | "all"): Quote[] {
  if (status === "all") return quotes;
  return quotes.filter((q) => q.status === status);
}

/**
 * Get quotes count by status
 */
export function getQuoteCountsByStatus(
  quotes: Quote[]
): Record<QuoteStatus | "all", number> {
  const counts: Record<string, number> = {
    all: quotes.length,
    draft: 0,
    calculated: 0,
    sent: 0,
    accepted: 0,
    rejected: 0,
  };

  for (const quote of quotes) {
    counts[quote.status] = (counts[quote.status] ?? 0) + 1;
  }

  return counts as Record<QuoteStatus | "all", number>;
}

/**
 * Get sent quotes count for current month (for paywall)
 */
export function getSentQuotesThisMonth(quotes: Quote[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return quotes.filter((q) => {
    if (q.status !== "sent") return false;
    const sentDate = new Date(q.sent_at ?? q.created_at);
    return sentDate >= startOfMonth;
  }).length;
}

/**
 * Check if quote can be edited
 */
export function canEditQuote(quote: Quote): boolean {
  return quote.status === "draft" || quote.status === "calculated";
}

/**
 * Check if quote can be sent
 */
export function canSendQuote(quote: Quote): boolean {
  return (
    quote.status !== "sent" &&
    quote.variants.length > 0 &&
    quote.total > 0
  );
}

/**
 * Get status badge color
 */
export function getStatusColor(status: QuoteStatus): string {
  const colors: Record<QuoteStatus, string> = {
    draft: "#9ca3af", // gray
    calculated: "#3b82f6", // blue
    sent: "#f59e0b", // amber
    accepted: "#22c55e", // green
    rejected: "#ef4444", // red
  };

  return colors[status] ?? "#9ca3af";
}

/**
 * Get status display label
 */
export function getStatusLabel(status: QuoteStatus): string {
  const labels: Record<QuoteStatus, string> = {
    draft: "Draft",
    calculated: "Calculated",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
  };

  return labels[status] ?? status;
}

/**
 * Format quote date for display
 */
export function formatQuoteDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

/**
 * Get quote summary for list display
 */
export function getQuoteSummary(quote: Quote): string {
  const fenceType = quote.inputs?.fence_type ?? "fence";
  const length = quote.inputs?.length ?? 0;

  const typeLabels: Record<string, string> = {
    wood_privacy: "Wood Privacy",
    wood_picket: "Wood Picket",
    chain_link: "Chain Link",
    vinyl: "Vinyl",
    aluminum: "Aluminum",
  };

  const label = typeLabels[fenceType] ?? fenceType;
  return `${label} • ${length} ft`;
}
