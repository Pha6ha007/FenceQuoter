// app/(app)/paywall.tsx
// Paywall screen — CLAUDE.md section 4.8

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEntitlements } from "@/hooks/useEntitlements";
import { supabase } from "@/lib/supabase";

const FREE_QUOTE_LIMIT = 3;

const PRO_FEATURES = [
  { icon: "✨", text: "Unlimited sent quotes" },
  { icon: "📄", text: "No watermark on PDFs" },
  { icon: "🎨", text: "Custom branding" },
  { icon: "⚡", text: "Priority support" },
];

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; quoteId?: string }>();

  const [sentCount, setSentCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const RC_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
  const RC_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

  const ent = useEntitlements({
    userId,
    email,
    revenueCatIosApiKey: RC_IOS,
    revenueCatAndroidApiKey: RC_ANDROID,
  });

  const offering = ent.offerings?.current ?? null;

  const monthlyPkg = useMemo(() => {
    if (!offering) return null;
    const off = offering as { monthly?: unknown; annual?: unknown; availablePackages?: Array<{ packageType: string }> };
    if (off.monthly) return off.monthly;
    return off.availablePackages?.find((p) => p.packageType === "MONTHLY") ?? null;
  }, [offering]);

  const annualPkg = useMemo(() => {
    if (!offering) return null;
    const off = offering as { monthly?: unknown; annual?: unknown; availablePackages?: Array<{ packageType: string }> };
    if (off.annual) return off.annual;
    return off.availablePackages?.find((p) => p.packageType === "ANNUAL") ?? null;
  }, [offering]);

  const loadUserAndCount = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) {
      router.replace("/(auth)/login");
      return;
    }
    setUserId(u.id);
    setEmail(u.email ?? null);

    const { data: cnt, error } = await supabase.rpc("sent_quotes_this_month");
    if (!error) setSentCount(Number(cnt ?? 0));
    else setSentCount(0);
  }, [router]);

  useEffect(() => {
    loadUserAndCount();
  }, [loadUserAndCount]);

  useEffect(() => {
    if (ent.isReady && ent.isPro) {
      if (params.returnTo === "pdfPreview" && params.quoteId) {
        router.replace({ pathname: "/(app)/pdfPreview", params: { quoteId: params.quoteId } });
      } else {
        router.replace("/(app)/history");
      }
    }
  }, [ent.isPro, ent.isReady, params.quoteId, params.returnTo, router]);

  const handlePurchase = useCallback(
    async (kind: "monthly" | "annual") => {
      const pkg = kind === "monthly" ? monthlyPkg : annualPkg;
      if (!pkg) {
        Alert.alert("Not available", "This package is not configured yet. Please try again later.");
        return;
      }

      setBusy(true);
      try {
        await ent.purchasePackage(pkg);
        await ent.refresh();

        Alert.alert("Welcome to Pro!", "Your subscription is now active.");
        if (params.returnTo === "pdfPreview" && params.quoteId) {
          router.replace({ pathname: "/(app)/pdfPreview", params: { quoteId: params.quoteId } });
        } else {
          router.replace("/(app)/history");
        }
      } catch (e: unknown) {
        const error = e as Error;
        if (!error?.message?.includes("cancel")) {
          Alert.alert("Purchase failed", error?.message ?? "Could not complete purchase");
        }
      } finally {
        setBusy(false);
      }
    },
    [annualPkg, ent, monthlyPkg, params.quoteId, params.returnTo, router],
  );

  const handleRestore = useCallback(async () => {
    setBusy(true);
    try {
      await ent.restore();
      await ent.refresh();

      if (ent.isPro) {
        Alert.alert("Restored!", "Your purchases have been restored.");
        if (params.returnTo === "pdfPreview" && params.quoteId) {
          router.replace({ pathname: "/(app)/pdfPreview", params: { quoteId: params.quoteId } });
        } else {
          router.replace("/(app)/history");
        }
      } else {
        Alert.alert("No subscription found", "We couldn't find an active subscription for this account.");
      }
    } catch (e: unknown) {
      const error = e as Error;
      Alert.alert("Restore failed", error?.message ?? "Could not restore purchases");
    } finally {
      setBusy(false);
    }
  }, [ent, params.quoteId, params.returnTo, router]);

  const handleNotNow = useCallback(() => {
    router.back();
  }, [router]);

  // Progress bar calculation
  const usedQuotes = Math.min(sentCount ?? 0, FREE_QUOTE_LIMIT);
  const progressPercent = (usedQuotes / FREE_QUOTE_LIMIT) * 100;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-gray-900">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="flex-1 px-6 py-8"
          style={{
            maxWidth: Platform.OS === "web" ? 480 : undefined,
            width: "100%",
            alignSelf: "center",
          }}
        >
          {/* Crown Icon */}
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full items-center justify-center">
              <Text className="text-5xl">👑</Text>
            </View>
          </View>

          {/* Title */}
          <Text className="text-3xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Upgrade to Pro
          </Text>
          <Text className="text-base text-gray-500 dark:text-gray-400 text-center mb-6">
            Unlock the full potential of FenceQuoter
          </Text>

          {/* Progress Bar */}
          <View className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Free quotes this month
              </Text>
              <Text className="text-sm font-bold text-gray-900 dark:text-white">
                {usedQuotes}/{FREE_QUOTE_LIMIT}
              </Text>
            </View>
            <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${
                  usedQuotes >= FREE_QUOTE_LIMIT ? "bg-red-500" : "bg-blue-600"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </View>
            {usedQuotes >= FREE_QUOTE_LIMIT && (
              <Text className="text-sm text-red-600 dark:text-red-400 mt-2">
                You've reached your free limit. Upgrade to continue sending quotes.
              </Text>
            )}
          </View>

          {/* Pro Features */}
          <View className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 border border-blue-200 dark:border-blue-800">
            <Text className="text-base font-bold text-gray-900 dark:text-white mb-3">
              Pro includes:
            </Text>
            <View className="gap-3">
              {PRO_FEATURES.map((feature, index) => (
                <View key={index} className="flex-row items-center gap-3">
                  <Text className="text-xl">{feature.icon}</Text>
                  <Text className="text-base text-gray-800 dark:text-gray-200">
                    {feature.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Pricing Buttons */}
          <View className="gap-3 mb-4">
            {/* Annual - Primary */}
            <Pressable
              className={`rounded-xl items-center justify-center ${
                busy ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
              }`}
              style={{ height: 56 }}
              onPress={() => handlePurchase("annual")}
              disabled={busy || !ent.isReady}
            >
              <View className="items-center">
                <View className="flex-row items-center gap-2">
                  <Text className="text-white font-bold text-lg">
                    $39/month
                  </Text>
                  <View className="bg-amber-400 rounded px-2 py-0.5">
                    <Text className="text-xs font-bold text-amber-900">SAVE 20%</Text>
                  </View>
                </View>
                <Text className="text-blue-200 text-xs">billed yearly ($468)</Text>
              </View>
            </Pressable>

            {/* Monthly - Secondary */}
            <Pressable
              className={`rounded-xl items-center justify-center border-2 border-gray-300 dark:border-gray-600 ${
                busy ? "opacity-50" : "active:bg-gray-100 dark:active:bg-gray-800"
              }`}
              style={{ height: 48 }}
              onPress={() => handlePurchase("monthly")}
              disabled={busy || !ent.isReady}
            >
              <Text className="text-gray-900 dark:text-white font-semibold text-base">
                $49/month
              </Text>
            </Pressable>
          </View>

          {/* Restore Purchases - Text Link */}
          <Pressable
            className="py-3 items-center"
            onPress={handleRestore}
            disabled={busy || !ent.isReady}
          >
            <Text className="text-blue-600 dark:text-blue-400 font-medium">
              Restore Purchases
            </Text>
          </Pressable>

          {/* Loading / Error */}
          {(busy || !ent.isReady) && (
            <View className="flex-row items-center justify-center gap-2 py-2">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="text-gray-500 dark:text-gray-400 text-sm">
                {busy ? "Processing..." : "Loading..."}
              </Text>
            </View>
          )}

          {ent.errorMessage && (
            <Text className="text-red-600 dark:text-red-400 text-sm text-center py-2">
              {ent.errorMessage}
            </Text>
          )}

          {/* Legal */}
          <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4 mb-6">
            Subscriptions are managed by {Platform.OS === "ios" ? "Apple" : Platform.OS === "android" ? "Google" : "your app store"}.
            Cancel anytime in your account settings.
          </Text>

          {/* Not Now - Text Link */}
          <View className="mt-auto pt-4">
            <Pressable
              className="py-4 items-center"
              onPress={handleNotNow}
              disabled={busy}
            >
              <Text className="text-gray-500 dark:text-gray-400 font-medium">
                Not now
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
