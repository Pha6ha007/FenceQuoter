// app/(app)/onboarding.tsx
// Onboarding screen — CLAUDE.md section 4.2

import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthContext } from "@/contexts/AuthContext";
import { REGIONAL_DEFAULTS } from "@/constants/defaults";
import { supabase } from "@/lib/supabase";
import type { RegionCode, UnitSystem } from "@/types/quote";

const REGIONS: { code: RegionCode; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "CA", label: "Canada" },
  { code: "UK", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "EU", label: "Europe" },
  { code: "Other", label: "Other" },
];

export default function OnboardingScreen() {
  const { user } = useAuthContext();

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState<RegionCode>("US");
  const [hourlyRate, setHourlyRate] = useState(
    String(REGIONAL_DEFAULTS.US.hourly_rate)
  );
  const [defaultMarkup, setDefaultMarkup] = useState("20");
  const [taxPercent, setTaxPercent] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedRegion = REGIONAL_DEFAULTS[region];

  const handleRegionChange = (newRegion: RegionCode) => {
    setRegion(newRegion);
    setHourlyRate(String(REGIONAL_DEFAULTS[newRegion].hourly_rate));
  };

  const handleSubmit = async () => {
    console.log("[onboarding] handleSubmit called");
    console.log("[onboarding] companyName:", companyName, "phone:", phone, "hourlyRate:", hourlyRate);

    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!companyName.trim()) {
      newErrors.companyName = "Company name is required";
    }
    if (!phone.trim()) {
      newErrors.phone = "Phone number is required";
    }
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      newErrors.hourlyRate = "Valid hourly rate is required";
    }

    if (Object.keys(newErrors).length > 0) {
      console.log("[onboarding] Validation failed:", newErrors);
      setErrors(newErrors);
      return;
    }

    console.log("[onboarding] Validation passed, submitting...");
    setIsSubmitting(true);

    const userId = user?.id;
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      setIsSubmitting(false);
      return;
    }

    try {
      // 1. Create/update profile
      console.log("[onboarding] Creating profile...");
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: userId,
          company_name: companyName.trim(),
          phone: phone.trim(),
          email: user.email ?? "",
          region,
          currency: selectedRegion.currency,
          unit_system: selectedRegion.unit_system as UnitSystem,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        console.error("[onboarding] Profile error:", profileError);
        Alert.alert("Error", `Failed to save profile: ${profileError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 2. Create/update settings
      console.log("[onboarding] Creating settings...");
      const { error: settingsError } = await supabase.from("settings").upsert(
        {
          user_id: userId,
          hourly_rate: parseFloat(hourlyRate) || 45,
          default_markup_percent: parseFloat(defaultMarkup) || 20,
          tax_percent: parseFloat(taxPercent) || 0,
          terms_template: "Quote valid for 30 days. 50% deposit required to begin work. Balance due upon completion.",
        },
        { onConflict: "user_id" }
      );

      if (settingsError) {
        console.error("[onboarding] Settings error:", settingsError);
        Alert.alert("Error", `Failed to save settings: ${settingsError.message}`);
        setIsSubmitting(false);
        return;
      }

      // 3. Seed materials
      console.log("[onboarding] Seeding materials...");
      const { error: seedError } = await supabase.rpc("seed_materials_for_user");

      if (seedError) {
        console.error("[onboarding] Seed materials error:", seedError);
        // Don't block on seed error, just log it
        console.warn("[onboarding] Materials seeding failed, continuing anyway");
      }

      console.log("[onboarding] Success! Navigating to history...");
      router.replace("./history");
    } catch (e) {
      console.error("[onboarding] Unexpected error:", e);
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        >
          <View
            className="p-6"
            style={{ maxWidth: Platform.OS === "web" ? 480 : undefined, width: "100%", alignSelf: "center" }}
          >
          {/* Header */}
          <View className="mb-6">
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to FenceQuoter
            </Text>
            <Text className="text-gray-500 dark:text-gray-400 mt-2 text-base">
              Let's set up your company profile
            </Text>
          </View>

          {/* Company Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name *
            </Text>
            <TextInput
              className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.companyName
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              placeholder="Your Fence Company"
              placeholderTextColor="#9ca3af"
              value={companyName}
              onChangeText={setCompanyName}
              autoCapitalize="words"
              editable={!isSubmitting}
            />
            {errors.companyName && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.companyName}
              </Text>
            )}
          </View>

          {/* Phone */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </Text>
            <TextInput
              className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.phone
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              editable={!isSubmitting}
            />
            {errors.phone && (
              <Text className="text-red-500 text-sm mt-1">{errors.phone}</Text>
            )}
          </View>

          {/* Region */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Region
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {REGIONS.map((r) => (
                <Pressable
                  key={r.code}
                  className={`px-4 py-2 rounded-lg border ${
                    region === r.code
                      ? "bg-blue-600 border-blue-600"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  }`}
                  onPress={() => handleRegionChange(r.code)}
                  disabled={isSubmitting}
                >
                  <Text
                    className={
                      region === r.code
                        ? "text-white font-medium"
                        : "text-gray-700 dark:text-gray-300"
                    }
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Currency: {selectedRegion.symbol} ({selectedRegion.currency}) •
              Units: {selectedRegion.unit_system}
            </Text>
          </View>

          {/* Hourly Rate */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hourly Labor Rate ({selectedRegion.symbol}) *
            </Text>
            <TextInput
              className={`border rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                errors.hourlyRate
                  ? "border-red-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              placeholder="45"
              placeholderTextColor="#9ca3af"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            {errors.hourlyRate && (
              <Text className="text-red-500 text-sm mt-1">
                {errors.hourlyRate}
              </Text>
            )}
          </View>

          {/* Default Markup */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Markup (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              placeholder="20"
              placeholderTextColor="#9ca3af"
              value={defaultMarkup}
              onChangeText={setDefaultMarkup}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
          </View>

          {/* Tax Percent */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sales Tax (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              value={taxPercent}
              onChangeText={setTaxPercent}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Add sales tax if applicable in your region
            </Text>
          </View>

          {/* Submit Button - Primary */}
          <TouchableOpacity
            className={`rounded-lg items-center justify-center ${
              isSubmitting ? "bg-blue-400" : "bg-blue-600"
            }`}
            style={{ height: 48 }}
            onPress={() => {
              console.log("BUTTON PRESSED");
              handleSubmit();
            }}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Start Quoting →
              </Text>
            )}
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
