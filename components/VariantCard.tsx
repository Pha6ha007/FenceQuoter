// components/VariantCard.tsx
// Quote variant card component — CLAUDE.md section 4.4

import { Pressable, Text, View } from "react-native";

import type { QuoteVariant, VariantType } from "@/types/quote";
import QuoteBreakdown from "./QuoteBreakdown";

// ============================================================
// TYPES
// ============================================================

interface VariantCardProps {
  variant: QuoteVariant;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (type: VariantType) => void;
  onToggleExpand: (type: VariantType) => void;
  currencySymbol?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const VARIANT_LABELS: Record<VariantType, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
};

// ============================================================
// COMPONENT
// ============================================================

export default function VariantCard({
  variant,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  currencySymbol = "$",
}: VariantCardProps) {
  const isRecommended = variant.type === "standard";

  return (
    <Pressable
      className={`rounded-xl p-4 border-2 ${
        isSelected
          ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
      }`}
      onPress={() => {
        onSelect(variant.type);
        onToggleExpand(variant.type);
      }}
    >
      {/* Header Row */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Text
            className={`text-lg font-semibold ${
              isSelected
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-900 dark:text-white"
            }`}
          >
            {VARIANT_LABELS[variant.type]}
          </Text>
          {isRecommended && (
            <View className="ml-2 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded">
              <Text className="text-xs text-green-700 dark:text-green-300 font-medium">
                Recommended
              </Text>
            </View>
          )}
        </View>

        {/* Selection Indicator */}
        <View
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
            isSelected
              ? "border-blue-600 bg-blue-600"
              : "border-gray-300 dark:border-gray-600"
          }`}
        >
          {isSelected && <Text className="text-white text-xs">✓</Text>}
        </View>
      </View>

      {/* Total Price */}
      <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {currencySymbol}
        {variant.total.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </Text>

      {/* Summary Row */}
      <View className="flex-row gap-4">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Materials & Labor: {currencySymbol}
          {variant.subtotal.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          Markup: {variant.markup_percent}%
        </Text>
      </View>

      {/* Expanded Breakdown */}
      {isExpanded && (
        <QuoteBreakdown variant={variant} currencySymbol={currencySymbol} />
      )}
    </Pressable>
  );
}

// ============================================================
// VARIANT LIST COMPONENT
// ============================================================

interface VariantListProps {
  variants: QuoteVariant[];
  selectedVariant: VariantType;
  expandedVariant: VariantType | null;
  onSelectVariant: (type: VariantType) => void;
  onToggleExpand: (type: VariantType) => void;
  currencySymbol?: string;
}

export function VariantList({
  variants,
  selectedVariant,
  expandedVariant,
  onSelectVariant,
  onToggleExpand,
  currencySymbol = "$",
}: VariantListProps) {
  // Sort variants: budget, standard, premium
  const sortedVariants = [...variants].sort((a, b) => {
    const order: Record<VariantType, number> = { budget: 0, standard: 1, premium: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <View className="gap-3">
      {sortedVariants.map((variant) => (
        <VariantCard
          key={variant.type}
          variant={variant}
          isSelected={selectedVariant === variant.type}
          isExpanded={expandedVariant === variant.type}
          onSelect={onSelectVariant}
          onToggleExpand={onToggleExpand}
          currencySymbol={currencySymbol}
        />
      ))}
    </View>
  );
}
