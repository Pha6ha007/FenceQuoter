// app/(app)/_layout.tsx
// Protected app layout with auth guard — CLAUDE.md section 3

import { Redirect, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuthContext } from "@/contexts/AuthContext";
import { checkOnboardingComplete } from "@/hooks/useAuth";

export default function AppLayout() {
  const { isLoading, isAuthenticated, user } = useAuthContext();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      if (!user?.id) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const completed = await checkOnboardingComplete(user.id);
        setHasCompletedOnboarding(completed);
      } catch (e) {
        setHasCompletedOnboarding(false);
      } finally {
        setCheckingOnboarding(false);
      }
    }

    if (isAuthenticated && user) {
      checkOnboarding();
    } else {
      setCheckingOnboarding(false);
    }
  }, [isAuthenticated, user]);

  // Show loading while checking auth state
  if (isLoading || checkingOnboarding) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // If authenticated but hasn't completed onboarding, redirect to onboarding
  // Exception: allow access to onboarding screen itself
  if (!hasCompletedOnboarding) {
    return (
      <Stack
        screenOptions={{
          headerShown: true,
          headerTitleStyle: { fontWeight: "600" },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            title: "Setup",
          }}
        />
        <Stack.Screen
          name="history"
          redirect={!hasCompletedOnboarding}
        />
      </Stack>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitleStyle: { fontWeight: "600" },
        headerBackTitle: "Back",
      }}
    >
      <Stack.Screen
        name="history"
        options={{
          title: "Quotes",
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          title: "Setup",
        }}
      />
      <Stack.Screen
        name="newQuote"
        options={{
          title: "New Quote",
          presentation: "card",
        }}
      />
      <Stack.Screen
        name="results"
        options={{
          title: "Results",
        }}
      />
      <Stack.Screen
        name="pdfPreview"
        options={{
          title: "Preview",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
        }}
      />
      <Stack.Screen
        name="paywall"
        options={{
          title: "Upgrade",
          presentation: "modal",
        }}
      />
    </Stack>
  );
}
