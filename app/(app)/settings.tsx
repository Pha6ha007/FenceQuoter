// app/(app)/settings.tsx
// Settings screen — CLAUDE.md section 4.7

import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthContext } from "@/contexts/AuthContext";

export default function SettingsScreen() {
  const { user, signOut } = useAuthContext();

  const [companyName, setCompanyName] = useState("My Fence Company");
  const [phone, setPhone] = useState("");
  const [hourlyRate, setHourlyRate] = useState("45");
  const [defaultMarkup, setDefaultMarkup] = useState("20");
  const [taxPercent, setTaxPercent] = useState("0");

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
            // TODO: Implement account deletion
            Alert.alert("Coming Soon", "Account deletion will be available soon.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView className="p-4">
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
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={companyName}
              onChangeText={setCompanyName}
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="(555) 123-4567"
              placeholderTextColor="#9ca3af"
              value={phone}
              onChangeText={setPhone}
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
              Hourly Labor Rate ($)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="decimal-pad"
            />
          </View>
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Markup (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={defaultMarkup}
              onChangeText={setDefaultMarkup}
              keyboardType="decimal-pad"
            />
          </View>
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Sales Tax (%)
            </Text>
            <TextInput
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              value={taxPercent}
              onChangeText={setTaxPercent}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

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
          <Pressable>
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
          <Pressable className="mb-3">
            <Text className="text-blue-600 dark:text-blue-400">
              Change Password
            </Text>
          </Pressable>
          <Pressable onPress={handleSignOut}>
            <Text className="text-red-600 dark:text-red-400">Sign Out</Text>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <Text className="text-base font-medium text-red-800 dark:text-red-300 mb-2">
            Danger Zone
          </Text>
          <Pressable onPress={handleDeleteAccount}>
            <Text className="text-red-600 dark:text-red-400">
              Delete Account
            </Text>
          </Pressable>
        </View>

        {/* About */}
        <View className="mt-6 items-center">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            FenceQuoter v1.0.0
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
