// hooks/useMaterials.ts
// Materials catalog management hook — CLAUDE.md section 2

import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Material, MaterialInsert, MaterialUpdate } from "@/types/database";
import type { FenceType, MaterialRecord } from "@/types/quote";

type MaterialsState = {
  isLoading: boolean;
  isSaving: boolean;
  materials: Material[];
  error: string | null;
};

type MaterialsActions = {
  fetchMaterials: () => Promise<void>;
  getMaterialsByFenceType: (fenceType: FenceType) => Material[];
  getMaterialByCategory: (fenceType: FenceType, category: string) => Material | undefined;
  updateMaterial: (id: string, updates: MaterialUpdate) => Promise<{ error: string | null }>;
  updatePrice: (id: string, newPrice: number) => Promise<{ error: string | null }>;
  addMaterial: (material: Omit<MaterialInsert, "user_id">) => Promise<{ error: string | null; id: string | null }>;
  deleteMaterial: (id: string) => Promise<{ error: string | null }>;
  toggleActive: (id: string) => Promise<{ error: string | null }>;
  seedMaterials: () => Promise<{ error: string | null }>;
  resetToDefaults: (fenceType?: FenceType) => Promise<{ error: string | null }>;
};

export type UseMaterialsReturn = MaterialsState & MaterialsActions;

export function useMaterials(userId: string | null): UseMaterialsReturn {
  const [state, setState] = useState<MaterialsState>({
    isLoading: true,
    isSaving: false,
    materials: [],
    error: null,
  });

  // ============================================================
  // FETCH MATERIALS
  // ============================================================

  const fetchMaterials = useCallback(async () => {
    if (!userId) {
      setState({
        isLoading: false,
        isSaving: false,
        materials: [],
        error: "Not authenticated",
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .eq("user_id", userId)
        .order("fence_type")
        .order("sort_order");

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
        materials: (data ?? []) as Material[],
        error: null,
      });
    } catch (e) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to fetch materials",
      }));
    }
  }, [userId]);

  // Auto-fetch on mount and when userId changes
  useEffect(() => {
    if (userId) {
      fetchMaterials();
    } else {
      setState({
        isLoading: false,
        isSaving: false,
        materials: [],
        error: null,
      });
    }
  }, [userId, fetchMaterials]);

  // ============================================================
  // GET MATERIALS BY FENCE TYPE
  // ============================================================

  const getMaterialsByFenceType = useCallback(
    (fenceType: FenceType): Material[] => {
      return state.materials.filter(
        (m) => m.fence_type === fenceType && m.is_active !== false
      );
    },
    [state.materials]
  );

  const getMaterialByCategory = useCallback(
    (fenceType: FenceType, category: string): Material | undefined => {
      return state.materials.find(
        (m) =>
          m.fence_type === fenceType &&
          m.category === category &&
          m.is_active !== false
      );
    },
    [state.materials]
  );

  // ============================================================
  // UPDATE MATERIAL
  // ============================================================

  const updateMaterial = useCallback(
    async (id: string, updates: MaterialUpdate): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { data, error } = await supabase
          .from("materials")
          .update(updates)
          .eq("id", id)
          .eq("user_id", userId) // Ensure user owns this material
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
          materials: prev.materials.map((m) =>
            m.id === id ? (data as Material) : m
          ),
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to update material";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // UPDATE PRICE (convenience method)
  // ============================================================

  const updatePrice = useCallback(
    async (id: string, newPrice: number): Promise<{ error: string | null }> => {
      if (newPrice < 0) {
        return { error: "Price cannot be negative" };
      }
      if (newPrice > 100000) {
        return { error: "Price seems too high" };
      }
      return updateMaterial(id, { unit_price: newPrice });
    },
    [updateMaterial]
  );

  // ============================================================
  // ADD MATERIAL
  // ============================================================

  const addMaterial = useCallback(
    async (
      material: Omit<MaterialInsert, "user_id">
    ): Promise<{ error: string | null; id: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated", id: null };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { data, error } = await supabase
          .from("materials")
          .insert({
            ...material,
            user_id: userId,
          })
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
          materials: [...prev.materials, data as Material],
          error: null,
        }));

        return { error: null, id: data.id };
      } catch (e) {
        const errorMsg = "Failed to add material";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg, id: null };
      }
    },
    [userId]
  );

  // ============================================================
  // DELETE MATERIAL
  // ============================================================

  const deleteMaterial = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        const { error } = await supabase
          .from("materials")
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
          materials: prev.materials.filter((m) => m.id !== id),
          error: null,
        }));

        return { error: null };
      } catch (e) {
        const errorMsg = "Failed to delete material";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId]
  );

  // ============================================================
  // TOGGLE ACTIVE
  // ============================================================

  const toggleActive = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const material = state.materials.find((m) => m.id === id);
      if (!material) {
        return { error: "Material not found" };
      }

      return updateMaterial(id, { is_active: !material.is_active });
    },
    [state.materials, updateMaterial]
  );

  // ============================================================
  // SEED MATERIALS
  // ============================================================

  const seedMaterials = useCallback(async (): Promise<{ error: string | null }> => {
    if (!userId) {
      return { error: "Not authenticated" };
    }

    // Check if materials already exist
    if (state.materials.length > 0) {
      return { error: null }; // Already seeded
    }

    setState((prev) => ({ ...prev, isSaving: true, error: null }));

    try {
      // Import default materials
      const { DEFAULT_MATERIALS } = await import("@/constants/defaults");

      // Insert default materials
      const materialsWithUserId = DEFAULT_MATERIALS.map((m, index) => ({
        user_id: userId,
        fence_type: m.fence_type,
        name: m.name,
        unit: m.unit,
        unit_price: m.unit_price,
        category: m.category,
        sort_order: index,
        is_active: true,
      }));

      const { error } = await supabase
        .from("materials")
        .insert(materialsWithUserId);

      if (error) {
        setState((prev) => ({ ...prev, isSaving: false, error: error.message }));
        return { error: error.message };
      }

      // Refresh materials list
      await fetchMaterials();

      return { error: null };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to seed materials";
      setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
      return { error: errorMsg };
    }
  }, [userId, state.materials.length, fetchMaterials]);

  // ============================================================
  // RESET TO DEFAULTS
  // ============================================================

  const resetToDefaults = useCallback(
    async (fenceType?: FenceType): Promise<{ error: string | null }> => {
      if (!userId) {
        return { error: "Not authenticated" };
      }

      setState((prev) => ({ ...prev, isSaving: true, error: null }));

      try {
        // Import default materials
        const { DEFAULT_MATERIALS } = await import("@/constants/defaults");

        // Filter by fence type if specified
        const materialsToSeed = fenceType
          ? DEFAULT_MATERIALS.filter((m) => m.fence_type === fenceType)
          : DEFAULT_MATERIALS;

        // Delete existing materials for the fence type (or all if not specified)
        let deleteQuery = supabase
          .from("materials")
          .delete()
          .eq("user_id", userId);

        if (fenceType) {
          deleteQuery = deleteQuery.eq("fence_type", fenceType);
        }

        const { error: deleteError } = await deleteQuery;

        if (deleteError) {
          setState((prev) => ({ ...prev, isSaving: false, error: deleteError.message }));
          return { error: deleteError.message };
        }

        // Insert default materials
        const materialsWithUserId = materialsToSeed.map((m, index) => ({
          user_id: userId,
          fence_type: m.fence_type,
          name: m.name,
          unit: m.unit,
          unit_price: m.unit_price,
          category: m.category,
          sort_order: index,
          is_active: true,
        }));

        const { error: insertError } = await supabase
          .from("materials")
          .insert(materialsWithUserId);

        if (insertError) {
          setState((prev) => ({ ...prev, isSaving: false, error: insertError.message }));
          return { error: insertError.message };
        }

        // Refresh
        await fetchMaterials();

        return { error: null };
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Failed to reset materials";
        setState((prev) => ({ ...prev, isSaving: false, error: errorMsg }));
        return { error: errorMsg };
      }
    },
    [userId, fetchMaterials]
  );

  return {
    ...state,
    fetchMaterials,
    getMaterialsByFenceType,
    getMaterialByCategory,
    updateMaterial,
    updatePrice,
    addMaterial,
    deleteMaterial,
    toggleActive,
    seedMaterials,
    resetToDefaults,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Convert Materials to MaterialRecords for calculator
 */
export function toMaterialRecords(materials: Material[]): MaterialRecord[] {
  return materials
    .filter((m) => m.is_active !== false)
    .map((m) => ({
      id: m.id,
      user_id: m.user_id,
      fence_type: m.fence_type,
      name: m.name,
      unit: m.unit,
      unit_price: m.unit_price,
      category: m.category,
      sort_order: m.sort_order,
      is_active: m.is_active,
    }));
}

/**
 * Group materials by fence type
 */
export function groupByFenceType(
  materials: Material[]
): Record<FenceType, Material[]> {
  const grouped: Record<string, Material[]> = {};

  for (const material of materials) {
    if (!grouped[material.fence_type]) {
      grouped[material.fence_type] = [];
    }
    grouped[material.fence_type].push(material);
  }

  return grouped as Record<FenceType, Material[]>;
}

/**
 * Group materials by category within a fence type
 */
export function groupByCategory(materials: Material[]): Record<string, Material[]> {
  const grouped: Record<string, Material[]> = {};

  for (const material of materials) {
    if (!grouped[material.category]) {
      grouped[material.category] = [];
    }
    grouped[material.category].push(material);
  }

  return grouped;
}

/**
 * Get total material count by fence type
 */
export function getMaterialCounts(
  materials: Material[]
): Record<FenceType, number> {
  const counts: Record<string, number> = {
    wood_privacy: 0,
    wood_picket: 0,
    chain_link: 0,
    vinyl: 0,
    aluminum: 0,
  };

  for (const material of materials) {
    if (material.is_active !== false) {
      counts[material.fence_type] = (counts[material.fence_type] ?? 0) + 1;
    }
  }

  return counts as Record<FenceType, number>;
}

/**
 * Check if materials are seeded for a user
 */
export function hasMaterials(materials: Material[]): boolean {
  return materials.length > 0;
}

/**
 * Check if all fence types have materials
 */
export function hasAllFenceTypeMaterials(materials: Material[]): boolean {
  const fenceTypes: FenceType[] = [
    "wood_privacy",
    "wood_picket",
    "chain_link",
    "vinyl",
    "aluminum",
  ];

  for (const fenceType of fenceTypes) {
    const hasMaterialsForType = materials.some(
      (m) => m.fence_type === fenceType && m.is_active !== false
    );
    if (!hasMaterialsForType) {
      return false;
    }
  }

  return true;
}

/**
 * Format material price for display
 */
export function formatMaterialPrice(
  material: Material,
  currencySymbol: string = "$"
): string {
  return `${currencySymbol}${material.unit_price.toFixed(2)}/${material.unit}`;
}

/**
 * Get category display name
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    post: "Posts",
    rail: "Rails",
    panel: "Panels/Pickets",
    concrete: "Concrete",
    hardware: "Hardware",
    gate: "Gates",
  };

  return labels[category] ?? category;
}

/**
 * Sort materials by category order
 */
export function sortByCategory(materials: Material[]): Material[] {
  const categoryOrder = ["post", "rail", "panel", "concrete", "hardware", "gate"];

  return [...materials].sort((a, b) => {
    const aIndex = categoryOrder.indexOf(a.category);
    const bIndex = categoryOrder.indexOf(b.category);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    return a.sort_order - b.sort_order;
  });
}
