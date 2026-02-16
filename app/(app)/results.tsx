// app/(app)/results.tsx
// Quote results screen — CLAUDE.md section 4.4

import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { VariantList } from "@/components/VariantCard";
import { useOfflineQuote } from "@/hooks/useOfflineQuote";
import type { QuoteVariant, VariantType } from "@/types/quote";

export default function ResultsScreen() {
  // Get navigation params
  const params = useLocalSearchParams<{
    variants?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    clientAddress?: string;
    fenceType?: string;
    readOnly?: string;
  }>();

  // Parse variants from params or use draft
  const { draft, setCalculatedVariants } = useOfflineQuote();

  const variants = useMemo<QuoteVariant[]>(() => {
    // Try to parse from params first
    if (params.variants) {
      try {
        return JSON.parse(params.variants) as QuoteVariant[];
      } catch (e) {
        console.error("Failed to parse variants from params:", e);
      }
    }
    // Fall back to draft variants
    return draft.variants ?? [];
  }, [params.variants, draft.variants]);

  const clientName = params.clientName ?? draft.client_name ?? "Client";
  const isReadOnly = params.readOnly === "true";

  // State
  const [selectedVariant, setSelectedVariant] = useState<VariantType>(
    (draft.selected_variant as VariantType) ?? "standard"
  );
  const [expandedVariant, setExpandedVariant] = useState<VariantType | null>(null);

  // Get selected variant data
  const selectedVariantData = useMemo(
    () => variants.find((v) => v.type === selectedVariant),
    [variants, selectedVariant]
  );

  // Handle variant selection
  const handleSelectVariant = (type: VariantType) => {
    setSelectedVariant(type);
    if (!isReadOnly) {
      setCalculatedVariants(variants, type);
    }
  };

  // Handle expand/collapse
  const handleToggleExpand = (type: VariantType) => {
    setExpandedVariant((prev) => (prev === type ? null : type));
  };

  // Handle generate PDF
  const handleGeneratePDF = () => {
    if (!selectedVariantData) {
      Alert.alert("Error", "Please select a variant first");
      return;
    }

    // Navigate to PDF preview with selected variant
    router.push({
      pathname: "./pdfPreview",
      params: {
        variant: JSON.stringify(selectedVariantData),
        clientName: params.clientName ?? draft.client_name,
        clientEmail: params.clientEmail ?? draft.client_email,
        clientPhone: params.clientPhone ?? draft.client_phone,
        clientAddress: params.clientAddress ?? draft.client_address,
        fenceType: params.fenceType ?? draft.inputs?.fence_type,
      },
    });
  };

  // Handle edit quote
  const handleEditQuote = () => {
    router.back();
  };

  // Empty state
  if (variants.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center p-6">
        <Text className="text-6xl mb-4">📊</Text>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">
          No Quote Data
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
          Please fill out the quote form and calculate first.
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg py-3 px-6 active:bg-blue-700"
          onPress={() => router.push("./newQuote")}
        >
          <Text className="text-white font-semibold">Create New Quote</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView className="p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            Quote Options
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 mt-1">
            {isReadOnly ? `Quote for ${clientName}` : "Select a pricing tier for your client"}
          </Text>
        </View>

        {/* Client Info Summary */}
        {clientName && (
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Client
            </Text>
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {clientName}
            </Text>
            {params.clientAddress && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {params.clientAddress}
              </Text>
            )}
          </View>
        )}

        {/* Variant Cards */}
        <View className="mb-6">
          <VariantList
            variants={variants}
            selectedVariant={selectedVariant}
            expandedVariant={expandedVariant}
            onSelectVariant={handleSelectVariant}
            onToggleExpand={handleToggleExpand}
            currencySymbol="$"
          />
        </View>

        {/* Actions */}
        {!isReadOnly && (
          <View className="gap-3 mb-6">
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
              onPress={handleEditQuote}
            >
              <Text className="text-gray-700 dark:text-gray-300 text-center font-medium">
                Edit Quote
              </Text>
            </Pressable>
          </View>
        )}

        {/* Read-only actions */}
        {isReadOnly && (
          <View className="gap-3 mb-6">
            <Pressable
              className="bg-blue-600 rounded-lg py-4 px-4 active:bg-blue-700"
              onPress={handleGeneratePDF}
            >
              <Text className="text-white text-center font-semibold text-lg">
                View PDF
              </Text>
            </Pressable>

            <Pressable
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4"
              onPress={() => router.push("./history")}
            >
              <Text className="text-gray-700 dark:text-gray-300 text-center font-medium">
                Back to History
              </Text>
            </Pressable>
          </View>
        )}

        {/* Selected Variant Summary */}
        {selectedVariantData && (
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-sm font-medium text-blue-800 dark:text-blue-300">
                  Selected: {selectedVariant.charAt(0).toUpperCase() + selectedVariant.slice(1)}
                </Text>
                <Text className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  ${selectedVariantData.total.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View className="bg-blue-100 dark:bg-blue-800 rounded-full px-3 py-1">
                <Text className="text-sm font-medium text-blue-700 dark:text-blue-200">
                  {selectedVariantData.markup_percent}% markup
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
