// app/index.tsx
// Root route handler — redirects based on auth state

import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthContext } from "@/contexts/AuthContext";

export default function IndexScreen() {
  const { isLoading, isAuthenticated } = useAuthContext();

  // Show loading while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Redirect based on auth state
  if (isAuthenticated) {
    return <Redirect href="/(app)/history" />;
  }

  return <Redirect href="/(auth)/login" />;
}
