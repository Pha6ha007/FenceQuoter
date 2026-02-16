// app/(app)/results.tsx
// Quote results screen — CLAUDE.md section 4.4

import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { VariantType } from "@/types/quote";

// Placeholder data for demonstration
const MOCK_VARIANTS = [
  {
    type: "budget" as VariantType,
    label: "Budget",
    total: 2450,
    subtotal: 2100,
    markup_amount: 262.5,
    tax_amount: 87.5,
    markup_percent: 15,
  },
  {
    type: "standard" as VariantType,
    label: "Standard",
    total: 2850,
    subtotal: 2100,
    markup_amount: 420,
    tax_amount: 330,
    markup_percent: 20,
    recommended: true,
  },
  {
    type: "premium" as VariantType,
    label: "Premium",
    total: 3350,
    subtotal: 2100,
    markup_amount: 630,
    tax_amount: 620,
    markup_percent: 30,
  },
];

export default function ResultsScreen() {
  const [selectedVariant, setSelectedVariant] = useState<VariantType>("standard");
  const [expandedVariant, setExpandedVariant] = useState<VariantType | null>(null);

  const handleGeneratePDF = () => {
    // TODO: Save quote and navigate to PDF preview
    router.push("./pdfPreview");
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView className="p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            Quote Options
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 mt-1">
            Select a pricing tier for your client
          </Text>
        </View>

        {/* Variant Cards */}
        <View className="gap-3 mb-6">
          {MOCK_VARIANTS.map((variant) => (
            <Pressable
              key={variant.type}
              className={`rounded-xl p-4 border-2 ${
                selectedVariant === variant.type
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              }`}
              onPress={() => {
                setSelectedVariant(variant.type);
                setExpandedVariant(
                  expandedVariant === variant.type ? null : variant.type
                );
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text
                    className={`text-lg font-semibold ${
                      selectedVariant === variant.type
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {variant.label}
                  </Text>
                  {variant.recommended && (
                    <View className="ml-2 bg-green-100 dark:bg-green-900 px-2 py-0.5 rounded">
                      <Text className="text-xs text-green-700 dark:text-green-300 font-medium">
                        Recommended
                      </Text>
                    </View>
                  )}
                </View>
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                    selectedVariant === variant.type
                      ? "border-blue-600 bg-blue-600"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {selectedVariant === variant.type && (
                    <Text className="text-white text-xs">✓</Text>
                  )}
                </View>
              </View>

              <Text className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                ${variant.total.toLocaleString()}
              </Text>

              <View className="flex-row gap-4">
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Materials & Labor: ${variant.subtotal.toLocaleString()}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  Markup: {variant.markup_percent}%
                </Text>
              </View>

              {/* Expanded Details */}
              {expandedVariant === variant.type && (
                <View className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-600 dark:text-gray-400">
                      Subtotal
                    </Text>
                    <Text className="text-gray-900 dark:text-white">
                      ${variant.subtotal.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-600 dark:text-gray-400">
                      Markup ({variant.markup_percent}%)
                    </Text>
                    <Text className="text-gray-900 dark:text-white">
                      ${variant.markup_amount.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-gray-600 dark:text-gray-400">Tax</Text>
                    <Text className="text-gray-900 dark:text-white">
                      ${variant.tax_amount.toLocaleString()}
                    </Text>
                  </View>
                  <View className="flex-row justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    <Text className="font-semibold text-gray-900 dark:text-white">
                      Total
                    </Text>
                    <Text className="font-semibold text-gray-900 dark:text-white">
                      ${variant.total.toLocaleString()}
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {/* Actions */}
        <View className="gap-3">
          <Pressable
            className="bg-blue-600 rounded-lg py-4 px-4 active:bg-blue-700"
            onPress={handleGeneratePDF}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Generate PDF →
            </Text>
          </Pressable>

          <Pressable
            className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4"
            onPress={() => router.back()}
          >
            <Text className="text-gray-700 dark:text-gray-300 text-center font-medium">
              Edit Quote
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
