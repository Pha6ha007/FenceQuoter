// app/(app)/settings.tsx
// Settings screen — CLAUDE.md section 4.7

import Constants from "expo-constants";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import * as ImagePicker from "expo-image-picker";

import { useAuthContext } from "@/contexts/AuthContext";
import { useMaterials } from "@/hooks/useMaterials";
import { useProfile, getProfileCurrencySymbol } from "@/hooks/useProfile";
import { useSettings } from "@/hooks/useSettings";
import type { FenceType } from "@/types/quote";

export default function SettingsScreen() {
  const { user, signOut } = useAuthContext();
  const userId = user?.id ?? null;

  const {
    profile,
    isLoading: isProfileLoading,
    isSaving: isProfileSaving,
    updateProfile,
    uploadLogo,
  } = useProfile(userId);

  const {
    settings,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    updateSettings,
  } = useSettings(userId);

  const {
    materials,
    isLoading: isMaterialsLoading,
    isSaving: isMaterialsSaving,
    updateMaterial,
    resetToDefaults,
  } = useMaterials(userId);

  // Local form state
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [defaultMarkup, setDefaultMarkup] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [termsTemplate, setTermsTemplate] = useState("");

  // Materials accordion state
  const [expandedFenceType, setExpandedFenceType] = useState<FenceType | null>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const isLoading = isProfileLoading || isSettingsLoading || isMaterialsLoading;
  const isSaving = isProfileSaving || isSettingsSaving || isMaterialsSaving;

  const currencySymbol = getProfileCurrencySymbol(profile);

  // Initialize form from loaded data
  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  useEffect(() => {
    if (settings) {
      setHourlyRate(String(settings.hourly_rate ?? 45));
      setDefaultMarkup(String(settings.default_markup_percent ?? 20));
      setTaxPercent(String(settings.tax_percent ?? 0));
      setTermsTemplate(settings.terms_template ?? "");
    }
  }, [settings]);

  // Handle field changes
  const handleCompanyNameChange = (value: string) => {
    setCompanyName(value);
    setIsDirty(true);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setIsDirty(true);
  };

  const handleHourlyRateChange = (value: string) => {
    setHourlyRate(value);
    setIsDirty(true);
  };

  const handleMarkupChange = (value: string) => {
    setDefaultMarkup(value);
    setIsDirty(true);
  };

  const handleTaxChange = (value: string) => {
    setTaxPercent(value);
    setIsDirty(true);
  };

  const handleTermsChange = (value: string) => {
    setTermsTemplate(value);
    setIsDirty(true);
  };

  // Upload logo
  const handleUploadLogo = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow access to your photo library.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setIsUploadingLogo(true);
      const { error } = await uploadLogo(result.assets[0].uri);
      setIsUploadingLogo(false);

      if (error) {
        Alert.alert("Error", error);
      } else {
        Alert.alert("Success", "Logo uploaded successfully.");
      }
    } catch (e) {
      setIsUploadingLogo(false);
      Alert.alert("Error", "Failed to upload logo.");
    }
  };

  // Materials editing
  const handleStartEditPrice = (materialId: string, currentPrice: number) => {
    setEditingMaterialId(materialId);
    setEditingPrice(String(currentPrice));
  };

  const handleSavePrice = async (materialId: string) => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      Alert.alert("Invalid Price", "Please enter a valid price.");
      return;
    }

    const { error } = await updateMaterial(materialId, { unit_price: newPrice });
    if (error) {
      Alert.alert("Error", error);
    }
    setEditingMaterialId(null);
    setEditingPrice("");
  };

  const handleResetMaterials = () => {
    Alert.alert(
      "Reset Materials",
      "This will reset all material prices to their default values. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            const { error } = await resetToDefaults();
            if (error) {
              Alert.alert("Error", error);
            } else {
              Alert.alert("Success", "Materials reset to defaults.");
            }
          },
        },
      ]
    );
  };

  // Group materials by fence type
  const materialsByFenceType = materials.reduce((acc, mat) => {
    const fenceType = mat.fence_type as FenceType;
    if (!acc[fenceType]) acc[fenceType] = [];
    acc[fenceType].push(mat);
    return acc;
  }, {} as Record<FenceType, typeof materials>);

  const FENCE_TYPE_LABELS: Record<FenceType, string> = {
    wood_privacy: "Wood Privacy",
    wood_picket: "Wood Picket",
    chain_link: "Chain Link",
    vinyl: "Vinyl",
    aluminum: "Aluminum",
  };

  // Save changes
  const handleSave = useCallback(async () => {
    // Update profile
    const profileResult = await updateProfile({
      company_name: companyName.trim(),
      phone: phone.trim(),
    });

    if (profileResult.error) {
      Alert.alert("Error", profileResult.error);
      return;
    }

    // Update settings
    const rate = parseFloat(hourlyRate) || 45;
    const markup = parseFloat(defaultMarkup) || 20;
    const tax = parseFloat(taxPercent) || 0;

    const settingsResult = await updateSettings({
      hourly_rate: rate,
      default_markup_percent: markup,
      tax_percent: tax,
      terms_template: termsTemplate,
    });

    if (settingsResult.error) {
      Alert.alert("Error", settingsResult.error);
      return;
    }

    setIsDirty(false);
    Alert.alert("Saved", "Your settings have been updated.");
  }, [companyName, phone, hourlyRate, defaultMarkup, taxPercent, termsTemplate, updateProfile, updateSettings]);

  // Sign out
  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  // Delete account
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert("Coming Soon", "Account deletion will be available soon.");
          },
        },
      ]
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="text-gray-500 dark:text-gray-400 mt-4">
          Loading settings...
        </Text>
      </SafeAreaView>
    );
  }

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}>
        <View
          className="p-6"
          style={{ maxWidth: Platform.OS === "web" ? 640 : undefined, width: "100%", alignSelf: "center" }}
        >
        {/* Company Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Company
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm">
          {/* Logo */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Logo
            </Text>
            <View className="flex-row items-center gap-4">
              {profile?.logo_url ? (
                <View className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                  <View className="w-full h-full bg-gray-100 dark:bg-gray-700 items-center justify-center">
                    <Text className="text-2xl">🏢</Text>
                  </View>
                </View>
              ) : (
                <View className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 items-center justify-center">
                  <Text className="text-2xl text-gray-400">📷</Text>
                </View>
              )}
              <Pressable
                className={`flex-1 border border-gray-300 dark:border-gray-600 rounded-lg items-center justify-center ${
                  isUploadingLogo ? "bg-gray-100 dark:bg-gray-700" : ""
                }`}
                style={{ height: 48 }}
                onPress={handleUploadLogo}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Text className="text-blue-600 dark:text-blue-400 font-medium">
                    {profile?.logo_url ? "Change Logo" : "Upload Logo"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Company Name */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Company Name
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={companyName}
              onChangeText={handleCompanyNameChange}
              placeholder="Enter company name"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Phone */}
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              placeholder="(555) 123-4567"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Pricing Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Pricing
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Hourly Labor Rate ({currencySymbol})
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={hourlyRate}
              onChangeText={handleHourlyRateChange}
              keyboardType="decimal-pad"
              placeholder="45"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Markup (%)
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={defaultMarkup}
              onChangeText={handleMarkupChange}
              keyboardType="decimal-pad"
              placeholder="20"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sales Tax (%)
            </Text>
            <TextInput
              className="border border-gray-200 dark:border-gray-700 rounded-lg px-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={taxPercent}
              onChangeText={handleTaxChange}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Sales tax percentage if applicable
            </Text>
          </View>
        </View>

        {/* Save Button - Primary */}
        {isDirty && (
          <Pressable
            className={`rounded-xl mb-6 items-center justify-center shadow-sm ${
              isSaving ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
            }`}
            style={{ height: 48 }}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold text-base ml-2">
                  Saving...
                </Text>
              </View>
            ) : (
              <Text className="text-white text-center font-semibold text-base">
                Save Changes
              </Text>
            )}
          </Pressable>
        )}

        {/* Materials Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Materials
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl mb-6 overflow-hidden">
          {(Object.keys(FENCE_TYPE_LABELS) as FenceType[]).map((fenceType) => {
            const fenceMaterials = materialsByFenceType[fenceType] ?? [];
            const isExpanded = expandedFenceType === fenceType;

            return (
              <View key={fenceType}>
                {/* Accordion Header */}
                <Pressable
                  className={`flex-row items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 ${
                    isExpanded ? "bg-gray-50 dark:bg-gray-700/50" : ""
                  }`}
                  onPress={() => setExpandedFenceType(isExpanded ? null : fenceType)}
                >
                  <Text className="text-base font-medium text-gray-900 dark:text-white">
                    {FENCE_TYPE_LABELS[fenceType]}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-gray-500 dark:text-gray-400">
                      {fenceMaterials.length} items
                    </Text>
                    <Text className="text-gray-400">{isExpanded ? "▼" : "▶"}</Text>
                  </View>
                </Pressable>

                {/* Accordion Content */}
                {isExpanded && (
                  <View className="px-4 pb-4 pt-2">
                    {fenceMaterials.length === 0 ? (
                      <Text className="text-sm text-gray-500 dark:text-gray-400 py-2">
                        No materials configured
                      </Text>
                    ) : (
                      fenceMaterials.map((mat) => (
                        <View
                          key={mat.id}
                          className="flex-row items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                        >
                          <View className="flex-1 mr-3">
                            <Text
                              className="text-sm text-gray-900 dark:text-white"
                              numberOfLines={1}
                            >
                              {mat.name}
                            </Text>
                            <Text className="text-xs text-gray-500 dark:text-gray-400">
                              per {mat.unit}
                            </Text>
                          </View>
                          {editingMaterialId === mat.id ? (
                            <View className="flex-row items-center gap-2">
                              <Text className="text-gray-500">{currencySymbol}</Text>
                              <TextInput
                                className="border border-blue-500 rounded px-2 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                style={{ height: 36, width: 80 }}
                                value={editingPrice}
                                onChangeText={setEditingPrice}
                                keyboardType="decimal-pad"
                                autoFocus
                              />
                              <Pressable
                                className="bg-blue-600 rounded px-3 py-1"
                                onPress={() => handleSavePrice(mat.id)}
                              >
                                <Text className="text-white text-sm font-medium">Save</Text>
                              </Pressable>
                            </View>
                          ) : (
                            <Pressable
                              className="bg-gray-100 dark:bg-gray-700 rounded px-3 py-1"
                              onPress={() => handleStartEditPrice(mat.id, mat.unit_price)}
                            >
                              <Text className="text-gray-900 dark:text-white font-medium">
                                {currencySymbol}{mat.unit_price.toFixed(2)}
                              </Text>
                            </Pressable>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {/* Reset Button */}
          <Pressable
            className="p-4 border-t border-gray-200 dark:border-gray-700"
            onPress={handleResetMaterials}
          >
            <Text className="text-center text-red-600 dark:text-red-400 font-medium">
              Reset to Defaults
            </Text>
          </Pressable>
        </View>

        {/* Quote Terms Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Quote Terms
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm">
          <TextInput
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-base bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
            style={{ minHeight: 120 }}
            value={termsTemplate}
            onChangeText={handleTermsChange}
            placeholder="Quote valid for 30 days. 50% deposit required to begin work. Balance due upon completion."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
          />
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This text appears at the bottom of every quote PDF
          </Text>
        </View>

        {/* Subscription Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Subscription
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-base font-medium text-gray-900 dark:text-white">
                Free Plan
              </Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                3 quotes per month
              </Text>
            </View>
            <Pressable
              className="bg-blue-600 rounded-lg px-4 py-2 active:bg-blue-700"
              onPress={() => router.push("./paywall")}
            >
              <Text className="text-white font-medium">Upgrade</Text>
            </Pressable>
          </View>
          <Pressable className="py-2">
            <Text className="text-blue-600 dark:text-blue-400">
              Restore Purchases
            </Text>
          </Pressable>
        </View>

        {/* Account Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Account
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6">
          <View className="mb-4">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Email
            </Text>
            <Text className="text-base text-gray-900 dark:text-white">
              {user?.email ?? "Not available"}
            </Text>
          </View>
          <Pressable className="py-2 mb-2">
            <Text className="text-blue-600 dark:text-blue-400">
              Change Password
            </Text>
          </Pressable>
          <Pressable onPress={handleSignOut} className="py-2">
            <Text className="text-red-600 dark:text-red-400">Sign Out</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800 mb-6">
          <Text className="text-base font-medium text-red-800 dark:text-red-300 mb-2">
            Danger Zone
          </Text>
          <Pressable onPress={handleDeleteAccount} className="py-2">
            <Text className="text-red-600 dark:text-red-400">
              Delete Account
            </Text>
          </Pressable>
        </View>

        {/* About */}
        <View className="items-center mb-8">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            FenceQuoter v{appVersion}
          </Text>
          <View className="flex-row gap-4 mt-2">
            <Pressable>
              <Text className="text-sm text-blue-600 dark:text-blue-400">
                Privacy Policy
              </Text>
            </Pressable>
            <Pressable>
              <Text className="text-sm text-blue-600 dark:text-blue-400">
                Terms of Service
              </Text>
            </Pressable>
          </View>
          <Text className="text-xs text-gray-400 dark:text-gray-500 mt-4">
            support@fencequoter.app
          </Text>
        </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
