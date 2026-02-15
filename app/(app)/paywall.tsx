// app/(app)/paywall.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from "react-native";

import { useEntitlements } from "@/hooks/useEntitlements";
import { supabase } from "@/lib/supabase";

function Btn(props: { title: string; onPress: () => void; disabled?: boolean; variant?: "primary" | "secondary" }) {
  const v = props.variant ?? "primary";
  const base = "px-4 py-3 rounded-xl";
  const cls =
    v === "primary"
      ? `${base} ${props.disabled ? "bg-zinc-300" : "bg-black"}`
      : `${base} border border-zinc-300 ${props.disabled ? "opacity-70" : "opacity-100"}`;

  const textCls = v === "primary" ? "text-white font-bold" : "text-zinc-900 font-bold";

  return (
    <TouchableOpacity disabled={props.disabled} onPress={props.onPress} className={cls}>
      <Text className={textCls}>{props.title}</Text>
    </TouchableOpacity>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string; quoteId?: string }>();

  const [sentCount, setSentCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  // TODO: replace keys with your env injection
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
    // Typical RevenueCat naming:
    // offering.monthly / offering.annual might exist; otherwise scan packages
    if (!offering) return null;
    const direct = (offering as any).monthly;
    if (direct) return direct;
    return offering.availablePackages.find((p) => p.packageType === "MONTHLY") ?? null;
  }, [offering]);

  const annualPkg = useMemo(() => {
    if (!offering) return null;
    const direct = (offering as any).annual;
    if (direct) return direct;
    return offering.availablePackages.find((p) => p.packageType === "ANNUAL") ?? null;
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
    else setSentCount(null);
  }, [router]);

  useEffect(() => {
    loadUserAndCount();
  }, [loadUserAndCount]);

  useEffect(() => {
    if (ent.isReady && ent.isPro) {
      // Already pro, bounce back
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
        Alert.alert("Not available", "This package is not configured in RevenueCat yet.");
        return;
      }

      setBusy(true);
      try {
        await ent.purchasePackage(pkg);
        await ent.refresh();

        Alert.alert("You're Pro", "Subscription active.");
        if (params.returnTo === "pdfPreview" && params.quoteId) {
          router.replace({ pathname: "/(app)/pdfPreview", params: { quoteId: params.quoteId } });
        } else {
          router.replace("/(app)/history");
        }
      } catch (e: any) {
        Alert.alert("Purchase failed", e?.message ?? "Could not complete purchase");
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
        Alert.alert("Restored", "Purchases restored.");
        if (params.returnTo === "pdfPreview" && params.quoteId) {
          router.replace({ pathname: "/(app)/pdfPreview", params: { quoteId: params.quoteId } });
        } else {
          router.replace("/(app)/history");
        }
      } else {
        Alert.alert("No active subscription", "We didn't find an active subscription on this account.");
      }
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message ?? "Could not restore purchases");
    } finally {
      setBusy(false);
    }
  }, [ent, params.quoteId, params.returnTo, router]);

  return (
    <View className="flex-1 bg-white px-5 pt-6">
      <Text className="text-3xl font-extrabold">Go Pro</Text>

      <Text className="mt-2 text-zinc-600 text-base">
        {sentCount === null
          ? "Unlock unlimited quotes, remove watermark, and enable SMS sending."
          : `You've sent ${Math.min(sentCount, 3)}/3 free quotes this month.`}
      </Text>

      <View className="mt-5 rounded-2xl border border-zinc-200 p-4">
        <Text className="text-base font-bold">Pro includes</Text>
        <View className="mt-3 gap-2">
          <Text className="text-zinc-800">• Unlimited sent quotes</Text>
          <Text className="text-zinc-800">• No watermark on PDFs</Text>
          <Text className="text-zinc-800">• SMS sending</Text>
          <Text className="text-zinc-800">• Priority support</Text>
        </View>
      </View>

      <View className="mt-5 gap-3">
        <Btn
          title={annualPkg ? `${annualPkg.product.title}` : "$39/month (billed yearly)"}
          onPress={() => handlePurchase("annual")}
          disabled={busy || !ent.isReady}
          variant="primary"
        />
        <Btn
          title={monthlyPkg ? `${monthlyPkg.product.title}` : "$49/month"}
          onPress={() => handlePurchase("monthly")}
          disabled={busy || !ent.isReady}
          variant="secondary"
        />

        <Btn
          title="Restore Purchases"
          onPress={handleRestore}
          disabled={busy || !ent.isReady}
          variant="secondary"
        />
      </View>

      <View className="mt-5 flex-row items-center gap-2">
        {!ent.isReady || busy ? <ActivityIndicator /> : null}
        <Text className="text-zinc-500 text-sm">
          {ent.errorMessage ? ent.errorMessage : "Subscriptions handled by Apple/Google. Cancel anytime."}
        </Text>
      </View>

      <TouchableOpacity
        className="mt-auto mb-6 items-center"
        onPress={() => router.back()}
        disabled={busy}
      >
        <Text className="text-zinc-700 font-semibold">Not now</Text>
      </TouchableOpacity>
    </View>
  );
}
