// components/QuoteBreakdown.tsx
// Quote breakdown component showing detailed cost items — CLAUDE.md section 4.4

import { Text, View } from "react-native";

import type { QuoteItem, QuoteVariant } from "@/types/quote";

// ============================================================
// TYPES
// ============================================================

interface QuoteBreakdownProps {
  variant: QuoteVariant;
  currencySymbol?: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function QuoteBreakdown({
  variant,
  currencySymbol = "$",
}: QuoteBreakdownProps) {
  // Group items by category
  const materialItems = variant.items.filter((item) => item.category === "material");
  const laborItems = variant.items.filter((item) => item.category === "labor");
  const removalItems = variant.items.filter((item) => item.category === "removal");
  const customItems = variant.items.filter((item) => item.category === "custom");

  const formatCurrency = (amount: number) =>
    `${currencySymbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <View>
      {/* Materials Section */}
      {materialItems.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Materials
          </Text>
          {materialItems.map((item, index) => (
            <BreakdownRow
              key={`material-${index}`}
              item={item}
              currencySymbol={currencySymbol}
              index={index}
            />
          ))}
          <View className="flex-row justify-between pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Materials Subtotal
            </Text>
            <Text className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatCurrency(variant.materials_total)}
            </Text>
          </View>
        </View>
      )}

      {/* Labor Section */}
      {laborItems.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Labor
          </Text>
          {laborItems.map((item, index) => (
            <BreakdownRow
              key={`labor-${index}`}
              item={item}
              currencySymbol={currencySymbol}
              index={index}
            />
          ))}
          <View className="flex-row justify-between pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Text className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Labor Subtotal
            </Text>
            <Text className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatCurrency(variant.labor_total)}
            </Text>
          </View>
        </View>
      )}

      {/* Removal Section */}
      {removalItems.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Removal
          </Text>
          {removalItems.map((item, index) => (
            <BreakdownRow
              key={`removal-${index}`}
              item={item}
              currencySymbol={currencySymbol}
              index={index}
            />
          ))}
        </View>
      )}

      {/* Custom Items Section */}
      {customItems.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Custom Items
          </Text>
          {customItems.map((item, index) => (
            <BreakdownRow
              key={`custom-${index}`}
              item={item}
              currencySymbol={currencySymbol}
              index={index}
            />
          ))}
        </View>
      )}

      {/* Totals Section */}
      <View className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-600 dark:text-gray-400">Subtotal</Text>
          <Text className="text-gray-900 dark:text-white">
            {formatCurrency(variant.subtotal)}
          </Text>
        </View>

        <View className="flex-row justify-between mb-3">
          <Text className="text-gray-600 dark:text-gray-400">
            Markup ({variant.markup_percent}%)
          </Text>
          <Text className="text-gray-900 dark:text-white">
            {formatCurrency(variant.markup_amount)}
          </Text>
        </View>

        {variant.tax_amount > 0 && (
          <View className="flex-row justify-between mb-3">
            <Text className="text-gray-600 dark:text-gray-400">Tax</Text>
            <Text className="text-gray-900 dark:text-white">
              {formatCurrency(variant.tax_amount)}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between pt-3 mt-1 border-t border-gray-200 dark:border-gray-700">
          <Text className="font-semibold text-gray-900 dark:text-white">Total</Text>
          <Text className="font-semibold text-gray-900 dark:text-white">
            {formatCurrency(variant.total)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// BREAKDOWN ROW COMPONENT
// ============================================================

interface BreakdownRowProps {
  item: QuoteItem;
  currencySymbol: string;
  index: number;
}

function BreakdownRow({ item, currencySymbol, index }: BreakdownRowProps) {
  const formatQtyUnit = (qty: number, unit: string) => {
    if (unit === "hours" || unit === "hr") {
      return `${qty.toFixed(1)} hrs`;
    }
    if (unit === "ft" || unit === "feet") {
      return `${qty.toFixed(0)} ft`;
    }
    // Default: show qty with unit (e.g., "14 each", "5 bag")
    const unitLabel = unit || "each";
    return `${Math.round(qty * 100) / 100} ${unitLabel}`;
  };

  const isEven = index % 2 === 0;

  return (
    <View
      className={`py-2.5 px-3 rounded-lg ${isEven ? "bg-gray-200/70 dark:bg-gray-700/50" : ""}`}
    >
      {/* Name row with dotted leader and price */}
      <View className="flex-row items-baseline">
        <Text
          className="text-sm text-gray-700 dark:text-gray-300 flex-shrink"
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {/* Dotted leader */}
        <Text
          className="flex-1 text-gray-400 dark:text-gray-600 mx-1 overflow-hidden"
          numberOfLines={1}
        >
          {'·'.repeat(100)}
        </Text>
        {/* Price - bold and slightly larger */}
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {currencySymbol}
          {item.total.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </View>
      {/* Qty × unit price row */}
      <Text className="text-xs text-gray-500 dark:text-gray-500 mt-1">
        {formatQtyUnit(item.qty, item.unit)} × {currencySymbol}
        {item.unit_price.toFixed(2)}
      </Text>
    </View>
  );
}

// ============================================================
// SIMPLE BREAKDOWN (for compact view)
// ============================================================

interface SimpleBreakdownProps {
  variant: QuoteVariant;
  currencySymbol?: string;
}

export function SimpleBreakdown({ variant, currencySymbol = "$" }: SimpleBreakdownProps) {
  const formatCurrency = (amount: number) =>
    `${currencySymbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">Materials</Text>
        <Text className="text-gray-900 dark:text-white">
          {formatCurrency(variant.materials_total)}
        </Text>
      </View>

      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">Labor</Text>
        <Text className="text-gray-900 dark:text-white">
          {formatCurrency(variant.labor_total)}
        </Text>
      </View>

      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">Subtotal</Text>
        <Text className="text-gray-900 dark:text-white">
          {formatCurrency(variant.subtotal)}
        </Text>
      </View>

      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-600 dark:text-gray-400">
          Markup ({variant.markup_percent}%)
        </Text>
        <Text className="text-gray-900 dark:text-white">
          {formatCurrency(variant.markup_amount)}
        </Text>
      </View>

      {variant.tax_amount > 0 && (
        <View className="flex-row justify-between mb-2">
          <Text className="text-gray-600 dark:text-gray-400">Tax</Text>
          <Text className="text-gray-900 dark:text-white">
            {formatCurrency(variant.tax_amount)}
          </Text>
        </View>
      )}

      <View className="flex-row justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <Text className="font-semibold text-gray-900 dark:text-white">Total</Text>
        <Text className="font-semibold text-gray-900 dark:text-white">
          {formatCurrency(variant.total)}
        </Text>
      </View>
    </View>
  );
}
