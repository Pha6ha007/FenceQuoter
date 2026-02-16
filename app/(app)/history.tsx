// app/(app)/history.tsx
// Quote history screen — CLAUDE.md section 4.6

import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuthContext } from "@/contexts/AuthContext";

export default function HistoryScreen() {
  const { signOut } = useAuthContext();

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView
        className="flex-1 p-4"
      >
        {/* Empty State */}
        <View className="flex-1 items-center justify-center py-20">
          <View className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full items-center justify-center mb-4">
            <Text className="text-4xl">📋</Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Quotes Yet
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
            Create your first quote to get started
          </Text>
          <Link href="./newQuote" asChild>
            <Pressable className="bg-blue-600 rounded-lg py-3 px-6 active:bg-blue-700">
              <Text className="text-white font-semibold">Create Quote</Text>
            </Pressable>
          </Link>
        </View>

        {/* Temporary: Settings and Logout */}
        <View className="mt-8 gap-3">
          <Link href="./settings" asChild>
            <Pressable className="bg-white dark:bg-gray-800 rounded-lg py-3 px-4 border border-gray-200 dark:border-gray-700">
              <Text className="text-gray-700 dark:text-gray-300 text-center">
                Settings
              </Text>
            </Pressable>
          </Link>
          <Pressable
            className="bg-red-50 dark:bg-red-900/20 rounded-lg py-3 px-4 border border-red-200 dark:border-red-800"
            onPress={signOut}
          >
            <Text className="text-red-600 dark:text-red-400 text-center">
              Sign Out
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* FAB */}
      <Link href="./newQuote" asChild>
        <Pressable className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg active:bg-blue-700">
          <Text className="text-white text-3xl font-light">+</Text>
        </Pressable>
      </Link>
    </SafeAreaView>
  );
}
