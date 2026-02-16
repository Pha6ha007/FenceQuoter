// app/(auth)/_layout.tsx
// Auth group layout — CLAUDE.md section 3

import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuthContext } from "@/contexts/AuthContext";

export default function AuthLayout() {
  const { isLoading, isAuthenticated } = useAuthContext();

  // Show loading indicator while checking auth state
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If authenticated, redirect to app
  if (isAuthenticated) {
    return <Redirect href="/(app)/history" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "white" },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="resetPassword" />
    </Stack>
  );
}
