// app/(app)/pdfPreview.tsx
// PDF preview and sending screen — CLAUDE.md section 4.5

import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { generateQuotePdf } from "@/lib/pdf";
import type { QuoteVariant, VariantType } from "@/types/quote";
import { sendQuoteEmail, sendQuoteSms } from "@/lib/send";
import { quotePdfPath, uploadPdfToBucket } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// Types for Supabase rows
interface QuoteRow {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  created_at: string;
  selected_variant: VariantType;
  variants: QuoteVariant[];
  pdf_url: string | null;
  status: string;
}

interface ProfileRow {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
}

interface SettingsRow {
  user_id: string;
  terms_template: string;
}

export default function PdfPreviewScreen() {
  const params = useLocalSearchParams<{ quoteId?: string }>();
  const quoteId = params.quoteId;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);

  const [pdfFileUri, setPdfFileUri] = useState<string | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);

  // TODO: replace with RevenueCat entitlement
  const [isPro, setIsPro] = useState(false);

  const currencySymbol = useMemo(() => {
    const c = profile?.currency ?? "USD";
    if (c === "GBP") return "£";
    if (c === "EUR") return "€";
    if (c === "AUD") return "A$";
    if (c === "CAD") return "C$";
    return "$";
  }, [profile?.currency]);

  const requireQuoteId = useCallback(() => {
    if (!quoteId) {
      Alert.alert("Missing quote", "No quote id provided.");
      router.replace("/(app)/history");
      return false;
    }
    return true;
  }, [quoteId, router]);

  const loadData = useCallback(async () => {
    if (!requireQuoteId()) return;

    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace("/(auth)/login");
        return;
      }

      const q = await supabase
        .from("quotes")
        .select("id,user_id,client_name,client_email,client_phone,client_address,created_at,selected_variant,variants,pdf_url,status")
        .eq("id", quoteId!)
        .single();

      if (q.error) throw q.error;
      setQuote(q.data as QuoteRow);

      const p = await supabase
        .from("profiles")
        .select("id,company_name,phone,email,logo_url,currency")
        .eq("id", user.id)
        .single();

      if (p.error) throw p.error;
      setProfile(p.data as ProfileRow);

      const s = await supabase
        .from("settings")
        .select("user_id,terms_template")
        .eq("user_id", user.id)
        .single();

      if (s.error) throw s.error;
      setSettings(s.data as SettingsRow);

      // If pdf already exists, keep it
      if ((q.data as any)?.pdf_url) setPdfPath((q.data as any).pdf_url);
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message ?? "Something went wrong");
      router.replace("/(app)/history");
    } finally {
      setLoading(false);
    }
  }, [quoteId, requireQuoteId, router]);

  const checkPaywall = useCallback(async () => {
    // Pro users never blocked
    if (isPro) return { ok: true as const };

    // Free limit: 3 sent quotes / month
    const { data, error } = await supabase.rpc("sent_quotes_this_month");
    if (error) {
      // fail open (don’t block user due to infra issue)
      return { ok: true as const };
    }
    const sentCount = Number(data ?? 0);
    if (sentCount >= 3) {
      return { ok: false as const, reason: `You've sent ${sentCount}/3 free quotes this month.` };
    }
    return { ok: true as const };
  }, [isPro]);

  const ensurePdfGeneratedAndUploaded = useCallback(async () => {
    if (!quote || !profile || !settings) throw new Error("Missing data");

    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) throw new Error("Not authenticated");

    // If we already uploaded (pdfPath exists), we don't need to regenerate/upload.
    if (pdfPath) return { pdfPath };

    // Generate local PDF
    const res = await generateQuotePdf({
      quoteId: quote.id,
      createdAtISO: quote.created_at,
      companyName: profile.company_name,
      companyPhone: profile.phone,
      companyEmail: profile.email,
      logoUrl: profile.logo_url,
      clientName: quote.client_name,
      clientAddress: quote.client_address,
      clientEmail: quote.client_email,
      clientPhone: quote.client_phone,
      selectedVariant: quote.selected_variant,
      variants: quote.variants,
      termsTemplate: settings.terms_template,
      currencySymbol,
      freeWatermark: !isPro,
      photoUrls: [], // MVP: can be filled with signed URLs from quote_photos later
    });

    setPdfFileUri(res.filePath);

    // Upload to Storage
    const path = quotePdfPath(user.id, quote.id);

    await uploadPdfToBucket({
      supabase,
      bucket: "quote-pdfs",
      path,
      fileUri: res.filePath,
      upsert: true,
    });

    // Save PATH in quotes.pdf_url
    const upd = await supabase.from("quotes").update({ pdf_url: path }).eq("id", quote.id);
    if (upd.error) throw upd.error;

    setPdfPath(path);
    return { pdfPath: path };
  }, [currencySymbol, isPro, pdfPath, profile, quote, settings]);

  const handleGenerate = useCallback(async () => {
    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push("/(app)/paywall");
      return;
    }

    setBusy(true);
    try {
      await ensurePdfGeneratedAndUploaded();
      Alert.alert("PDF ready", "Your PDF has been generated.");
    } catch (e: any) {
      Alert.alert("PDF failed", e?.message ?? "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  }, [checkPaywall, ensurePdfGeneratedAndUploaded, router]);

  const handleSendEmail = useCallback(async () => {
    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push("/(app)/paywall");
      return;
    }

    setBusy(true);
    try {
      await ensurePdfGeneratedAndUploaded();

      // If you want user to edit recipient: show modal later
      const to = quote?.client_email ?? undefined;

      if (!to) {
        Alert.alert("Missing email", "Client email is not set on this quote.");
        return;
      }

      await sendQuoteEmail(supabase, {
        quote_id: quote!.id,
        to,
        subject: "Your Fence Quote",
        message: `Hi ${quote!.client_name}, here is your quote.`,
      });

      Alert.alert("Sent", "Email sent to client.");
      router.replace("/(app)/history");
    } catch (e: any) {
      Alert.alert("Send failed", e?.message ?? "Could not send email");
    } finally {
      setBusy(false);
    }
  }, [checkPaywall, ensurePdfGeneratedAndUploaded, quote, router]);

  const handleSendSms = useCallback(async () => {
    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push("/(app)/paywall");
      return;
    }

    setBusy(true);
    try {
      await ensurePdfGeneratedAndUploaded();

      const to = quote?.client_phone ?? undefined;
      if (!to) {
        Alert.alert("Missing phone", "Client phone is not set on this quote.");
        return;
      }

      await sendQuoteSms(supabase, {
        quote_id: quote!.id,
        to,
        message: `Hi ${quote!.client_name}, your quote is ready: {{link}}`,
      });

      Alert.alert("Sent", "SMS sent to client.");
      router.replace("/(app)/history");
    } catch (e: any) {
      Alert.alert("Send failed", e?.message ?? "Could not send SMS");
    } finally {
      setBusy(false);
    }
  }, [checkPaywall, ensurePdfGeneratedAndUploaded, quote, router]);

  const handleShare = useCallback(async () => {
    setBusy(true);
    try {
      // Share local file if exists, else generate locally first (no need upload)
      if (!pdfFileUri) {
        // generate local without upload
        if (!quote || !profile || !settings) throw new Error("Missing data");
        const res = await generateQuotePdf({
          quoteId: quote.id,
          createdAtISO: quote.created_at,
          companyName: profile.company_name,
          companyPhone: profile.phone,
          companyEmail: profile.email,
          logoUrl: profile.logo_url,
          clientName: quote.client_name,
          clientAddress: quote.client_address,
          clientEmail: quote.client_email,
          clientPhone: quote.client_phone,
          selectedVariant: quote.selected_variant,
          variants: quote.variants,
          termsTemplate: settings.terms_template,
          currencySymbol,
          freeWatermark: !isPro,
          photoUrls: [],
        });
        setPdfFileUri(res.filePath);
      }

      await Share.share({
        message: "Fence quote PDF",
        url: pdfFileUri ?? undefined,
      });
    } catch (e: any) {
      Alert.alert("Share failed", e?.message ?? "Could not share");
    } finally {
      setBusy(false);
    }
  }, [currencySymbol, isPro, pdfFileUri, profile, quote, settings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-gray-500 dark:text-gray-400">Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!quote || !profile || !settings) {
    return (
      <SafeAreaView className="flex-1 bg-white dark:bg-gray-900 items-center justify-center p-6">
        <Text className="text-6xl mb-4">📄</Text>
        <Text className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Nothing to preview
        </Text>
        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
          We couldn't load this quote.
        </Text>
        <Pressable
          className="bg-blue-600 rounded-lg py-3 px-6 active:bg-blue-700"
          onPress={() => router.push("./history")}
        >
          <Text className="text-white font-semibold">Back to History</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const variantLabel = quote.selected_variant === "budget"
    ? "Budget"
    : quote.selected_variant === "premium"
    ? "Premium"
    : "Standard";

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={["bottom"]}>
      <ScrollView className="p-4">
        {/* Header */}
        <View className="mb-4">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white">
            PDF Preview
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 mt-1">
            Quote for {quote.client_name}
          </Text>
        </View>

        {/* Quote Info Card */}
        <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-200 dark:border-gray-700">
          <View className="flex-row justify-between items-start mb-3">
            <View>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                Selected Option
              </Text>
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                {variantLabel}
              </Text>
            </View>
            <View className="bg-blue-100 dark:bg-blue-900 rounded-full px-3 py-1">
              <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {currencySymbol}
                {(quote.variants.find(v => v.type === quote.selected_variant)?.total ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
            </View>
          </View>

          <View className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              PDF Status
            </Text>
            <Text className="font-medium text-gray-900 dark:text-white">
              {pdfPath ? "Ready to send" : pdfFileUri ? "Generated locally" : "Not generated yet"}
            </Text>
          </View>

          {!isPro && (
            <View className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
              <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Free Plan
              </Text>
              <Text className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Watermark will be included. Sending is limited to 3 quotes/month.
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View className="gap-3 mb-6">
          <Pressable
            className={`rounded-lg py-4 px-4 ${
              busy ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
            }`}
            onPress={handleGenerate}
            disabled={busy}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {pdfPath ? "Regenerate PDF" : "Generate PDF"}
            </Text>
          </Pressable>

          <Pressable
            className={`rounded-lg py-4 px-4 ${
              busy || !pdfPath ? "bg-green-400" : "bg-green-600 active:bg-green-700"
            }`}
            onPress={handleSendEmail}
            disabled={busy || !pdfPath}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Send Email
            </Text>
          </Pressable>

          <Pressable
            className={`rounded-lg py-4 px-4 ${
              busy || !pdfPath ? "bg-purple-400" : "bg-purple-600 active:bg-purple-700"
            }`}
            onPress={handleSendSms}
            disabled={busy || !pdfPath}
          >
            <Text className="text-white text-center font-semibold text-lg">
              Send SMS
            </Text>
          </Pressable>

          <Pressable
            className={`rounded-lg py-3 px-4 border ${
              busy
                ? "border-gray-200 dark:border-gray-700"
                : "border-gray-300 dark:border-gray-600 active:bg-gray-100 dark:active:bg-gray-800"
            }`}
            onPress={handleShare}
            disabled={busy}
          >
            <Text className="text-gray-700 dark:text-gray-300 text-center font-medium">
              Share
            </Text>
          </Pressable>
        </View>

        {/* Loading Indicator */}
        {busy && (
          <View className="flex-row items-center justify-center py-4">
            <ActivityIndicator color="#2563eb" />
            <Text className="text-gray-500 dark:text-gray-400 ml-3">
              Working...
            </Text>
          </View>
        )}

        {/* Back Button */}
        <Pressable
          className="py-3"
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text className="text-blue-600 dark:text-blue-400 text-center font-medium">
            Back to Quote
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
