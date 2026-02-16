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

import { useAuthContext } from "@/contexts/AuthContext";
import { useProfile, getProfileCurrencySymbol } from "@/hooks/useProfile";
import { useSettings } from "@/hooks/useSettings";

export default function SettingsScreen() {
  const { user, signOut } = useAuthContext();
  const userId = user?.id ?? null;

  const {
    profile,
    isLoading: isProfileLoading,
    isSaving: isProfileSaving,
    updateProfile,
  } = useProfile(userId);

  const {
    settings,
    isLoading: isSettingsLoading,
    isSaving: isSettingsSaving,
    updateSettings,
  } = useSettings(userId);

  // Local form state
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [defaultMarkup, setDefaultMarkup] = useState("");
  const [taxPercent, setTaxPercent] = useState("");
  const [termsTemplate, setTermsTemplate] = useState("");

  // Track if form is dirty
  const [isDirty, setIsDirty] = useState(false);

  const isLoading = isProfileLoading || isSettingsLoading;
  const isSaving = isProfileSaving || isSettingsSaving;

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
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <View
          className="p-4"
          style={{ maxWidth: Platform.OS === "web" ? 480 : undefined, width: "100%", alignSelf: "center" }}
        >
        {/* Company Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Company
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={companyName}
              onChangeText={handleCompanyNameChange}
              placeholder="Enter company name"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
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
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6">
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Hourly Labor Rate ({currencySymbol})
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={hourlyRate}
              onChangeText={handleHourlyRateChange}
              keyboardType="decimal-pad"
              placeholder="45"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Markup (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={defaultMarkup}
              onChangeText={handleMarkupChange}
              keyboardType="decimal-pad"
              placeholder="20"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sales Tax (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={{ height: 48 }}
              value={taxPercent}
              onChangeText={handleTaxChange}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#9ca3af"
            />
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Sales tax percentage if applicable
            </Text>
          </View>
        </View>

        {/* Save Button - Primary */}
        {isDirty && (
          <Pressable
            className={`rounded-lg mb-6 items-center justify-center ${
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

        {/* Subscription Section */}
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Subscription
        </Text>
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-6">
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
