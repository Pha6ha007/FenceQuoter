// app/(app)/newQuote.tsx
// New quote form screen — CLAUDE.md section 4.3

import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import QuoteForm from "@/components/QuoteForm";
import { useAuthContext } from "@/contexts/AuthContext";
import { useOfflineQuote, draftToQuoteInputs, formatLastSaved } from "@/hooks/useOfflineQuote";
import { useMaterials, toMaterialRecords } from "@/hooks/useMaterials";
import { useSettings, toCalculatorSettings } from "@/hooks/useSettings";
import { calculateQuote } from "@/lib/calculator";
import { quoteFormSchema, validate } from "@/lib/validation";
import type { FenceType, QuoteInputs, TerrainType } from "@/types/quote";

export default function NewQuoteScreen() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  // Hooks
  const {
    draft,
    isLoading: isDraftLoading,
    isSaving,
    lastSavedAt,
    updateClientInfo,
    updateInput,
    setCalculatedVariants,
    clearDraft,
  } = useOfflineQuote();

  const {
    materials,
    isLoading: isMaterialsLoading,
    getMaterialsByFenceType,
  } = useMaterials(userId);

  const { settings, isLoading: isSettingsLoading } = useSettings(userId);

  // Local state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCalculating, setIsCalculating] = useState(false);

  // Loading state
  const isLoading = isDraftLoading || isMaterialsLoading || isSettingsLoading;

  // Client info from draft
  const clientInfo = {
    client_name: draft.client_name,
    client_email: draft.client_email,
    client_phone: draft.client_phone,
    client_address: draft.client_address,
  };

  // Fence inputs from draft
  const fenceInputs = {
    fence_type: draft.inputs?.fence_type ?? ("wood_privacy" as FenceType),
    length: draft.inputs?.length ?? 0,
    height: draft.inputs?.height ?? 6,
    gates_standard: draft.inputs?.gates_standard ?? 0,
    gates_large: draft.inputs?.gates_large ?? 0,
    remove_old: draft.inputs?.remove_old ?? false,
    terrain: draft.inputs?.terrain ?? ("flat" as TerrainType),
    notes: draft.inputs?.notes ?? "",
  };

  // Handle client info change
  const handleClientInfoChange = (
    info: Partial<{
      client_name: string;
      client_email: string;
      client_phone: string;
      client_address: string;
    }>
  ) => {
    updateClientInfo(info);
    // Clear related errors
    const infoKeys = Object.keys(info);
    setErrors((prev) => {
      const newErrors = { ...prev };
      for (const key of infoKeys) {
        delete newErrors[key];
      }
      return newErrors;
    });
  };

  // Handle fence input change
  const handleInputChange = <K extends keyof QuoteInputs>(
    field: K,
    value: QuoteInputs[K]
  ) => {
    updateInput(field, value);
    // Clear related error
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  // Validate and calculate
  const handleCalculate = async () => {
    setErrors({});

    // Build form data for validation
    const formData = {
      client_name: clientInfo.client_name,
      client_email: clientInfo.client_email || undefined,
      client_phone: clientInfo.client_phone || undefined,
      client_address: clientInfo.client_address || undefined,
      fence_type: fenceInputs.fence_type,
      length: fenceInputs.length,
      height: fenceInputs.height,
      gates_standard: fenceInputs.gates_standard,
      gates_large: fenceInputs.gates_large,
      remove_old: fenceInputs.remove_old,
      terrain: fenceInputs.terrain,
      notes: fenceInputs.notes || undefined,
    };

    // Validate using quoteFormSchema
    const result = validate(quoteFormSchema, formData);

    if (!result.success) {
      setErrors(result.errors);
      // Scroll to first error or show alert
      const firstError = Object.values(result.errors)[0];
      Alert.alert("Validation Error", firstError);
      return;
    }

    setIsCalculating(true);

    try {
      // Get materials for the selected fence type
      const fenceMaterials = getMaterialsByFenceType(fenceInputs.fence_type);

      if (fenceMaterials.length === 0) {
        Alert.alert(
          "No Materials",
          "No materials found for this fence type. Please set up materials in Settings first."
        );
        setIsCalculating(false);
        return;
      }

      // Convert to calculator formats
      const quoteInputs = draftToQuoteInputs(draft);
      const materialRecords = toMaterialRecords(fenceMaterials);
      const calculatorSettings = toCalculatorSettings(settings);

      // Calculate quote
      const calculatorResult = calculateQuote(
        quoteInputs,
        materialRecords,
        calculatorSettings
      );

      // Save calculated variants to draft
      setCalculatedVariants(calculatorResult.variants, "standard");

      // Navigate to results with calculated data
      router.push({
        pathname: "./results",
        params: {
          variants: JSON.stringify(calculatorResult.variants),
          clientName: clientInfo.client_name,
          clientEmail: clientInfo.client_email,
          clientPhone: clientInfo.client_phone,
          clientAddress: clientInfo.client_address,
          fenceType: fenceInputs.fence_type,
        },
      });
    } catch (e) {
      console.error("Calculation error:", e);
      Alert.alert(
        "Calculation Error",
        "Failed to calculate quote. Please try again."
      );
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle clear draft
  const handleClearDraft = () => {
    Alert.alert(
      "Clear Draft",
      "Are you sure you want to clear this draft? All entered data will be lost.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => clearDraft(),
        },
      ]
    );
  };

  // Show loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 dark:text-gray-400 mt-4">
          Loading...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900" edges={["bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View
            className="p-4"
            style={{ maxWidth: Platform.OS === "web" ? 480 : undefined, width: "100%", alignSelf: "center" }}
          >
          {/* Header with save status */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-bold text-gray-900 dark:text-white">
                New Quote
              </Text>
              {lastSavedAt && (
                <Text className="text-sm text-gray-500 dark:text-gray-400">
                  {formatLastSaved(lastSavedAt)}
                </Text>
              )}
            </View>
            {isSaving && (
              <View className="flex-row items-center">
                <ActivityIndicator size="small" color="#9ca3af" />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                  Saving...
                </Text>
              </View>
            )}
          </View>

          {/* Quote Form */}
          <QuoteForm
            clientInfo={clientInfo}
            fenceInputs={fenceInputs}
            errors={errors}
            onClientInfoChange={handleClientInfoChange}
            onInputChange={handleInputChange}
            disabled={isCalculating}
          />

          {/* Action Buttons */}
          <View className="gap-3 mb-6">
            {/* Calculate Button - Primary */}
            <Pressable
              className={`rounded-lg items-center justify-center ${
                isCalculating ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
              }`}
              style={{ height: 48 }}
              onPress={handleCalculate}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator color="white" />
                  <Text className="text-white font-semibold text-base ml-2">
                    Calculating...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-center font-semibold text-base">
                  Calculate →
                </Text>
              )}
            </Pressable>

            {/* Clear Draft Button - Secondary */}
            <Pressable
              className="rounded-lg border border-gray-300 dark:border-gray-600 items-center justify-center"
              style={{ height: 48 }}
              onPress={handleClearDraft}
              disabled={isCalculating}
            >
              <Text className="text-gray-700 dark:text-gray-300 text-center font-medium text-base">
                Clear Draft
              </Text>
            </Pressable>
          </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
