// app/(app)/pdfPreview.tsx
// PDF preview and sending screen — CLAUDE.md section 4.5
// PDF generation requires development build (eas build --profile development)
// In Expo Go, we show HTML preview in WebView instead.

import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useEntitlements } from "@/hooks/useEntitlements";
import { generateQuotePdf, isPdfGenerationAvailable } from "@/lib/pdf";
import type { QuoteVariant, VariantType } from "@/types/quote";
import { sendQuoteEmail } from "@/lib/send";

// Conditionally import WebView for native platforms only
let WebView: React.ComponentType<{ source: { html: string }; style?: object; scrollEnabled?: boolean; showsVerticalScrollIndicator?: boolean }> | null = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch {
    // WebView not available
  }
}
import { quotePdfPath, uploadPdfToBucket } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// RevenueCat API keys (from environment)
const RC_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "";
const RC_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? "";

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
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // User info for RevenueCat
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // RevenueCat entitlements
  const { isPro, isReady: isEntitlementsReady } = useEntitlements({
    userId,
    email: userEmail,
    revenueCatIosApiKey: RC_IOS,
    revenueCatAndroidApiKey: RC_ANDROID,
  });

  // Track if we've done the initial paywall check
  const paywallCheckedRef = useRef(false);

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

      // Set user info for RevenueCat entitlements
      setUserId(user.id);
      setUserEmail(user.email ?? null);

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
    if (pdfPath) return { pdfPath, html: previewHtml };

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

    // Always store HTML for preview
    setPreviewHtml(res.html);

    // If PDF module not available (Expo Go), return HTML only
    if (!res.filePath) {
      return { pdfPath: null, html: res.html };
    }

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
    return { pdfPath: path, html: res.html };
  }, [currencySymbol, isPro, pdfPath, previewHtml, profile, quote, settings]);

  const handleGenerate = useCallback(async () => {
    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push({
        pathname: "/(app)/paywall",
        params: { returnTo: "pdfPreview", quoteId: quoteId ?? "" },
      });
      return;
    }

    setBusy(true);
    try {
      const result = await ensurePdfGeneratedAndUploaded();

      if (!result.pdfPath && result.html) {
        // PDF module not available (Expo Go) — show HTML preview
        setShowPreview(true);
        Alert.alert(
          "Preview Mode",
          "PDF generation requires a development build. Showing HTML preview instead."
        );
      } else {
        Alert.alert("PDF ready", "Your PDF has been generated.");
      }
    } catch (e: any) {
      Alert.alert("PDF failed", e?.message ?? "Could not generate PDF");
    } finally {
      setBusy(false);
    }
  }, [checkPaywall, ensurePdfGeneratedAndUploaded, quoteId, router]);

  const handleSendEmail = useCallback(async () => {
    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push({
        pathname: "/(app)/paywall",
        params: { returnTo: "pdfPreview", quoteId: quoteId ?? "" },
      });
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
  }, [checkPaywall, ensurePdfGeneratedAndUploaded, quote, quoteId, router]);

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

  // Web-only: Download PDF via browser print dialog
  const handleWebDownloadPdf = useCallback(async () => {
    if (Platform.OS !== "web") return;

    const gate = await checkPaywall();
    if (!gate.ok) {
      router.push({
        pathname: "/(app)/paywall",
        params: { returnTo: "pdfPreview", quoteId: quoteId ?? "" },
      });
      return;
    }

    setBusy(true);
    try {
      // Generate HTML if not already generated
      let html = previewHtml;
      if (!html && quote && profile && settings) {
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
        html = res.html;
        setPreviewHtml(html);
      }

      if (!html) {
        Alert.alert("Error", "Could not generate quote preview");
        return;
      }

      // Open new window with HTML and trigger print
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        // Small delay to ensure content is loaded
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        Alert.alert("Error", "Could not open print window. Please allow popups.");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not generate PDF";
      Alert.alert("Error", msg);
    } finally {
      setBusy(false);
    }
  }, [checkPaywall, currencySymbol, isPro, previewHtml, profile, quote, quoteId, router, settings]);

  // Web-only: Send email via mailto link
  const handleWebSendEmail = useCallback(() => {
    if (Platform.OS !== "web") return;

    if (!quote) {
      Alert.alert("Error", "Quote data not loaded");
      return;
    }

    const clientEmail = quote.client_email;
    if (!clientEmail) {
      Alert.alert("Missing email", "Client email is not set on this quote.");
      return;
    }

    const selectedVar = quote.variants.find(v => v.type === quote.selected_variant);
    const total = selectedVar?.total ?? 0;
    const formattedTotal = total.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const subject = encodeURIComponent("Your Fence Quote");
    const body = encodeURIComponent(
      `Hi ${quote.client_name},\n\n` +
      `Thank you for your interest in our fencing services.\n\n` +
      `Your quote total is ${currencySymbol}${formattedTotal} (${quote.selected_variant} option).\n\n` +
      `Please let us know if you have any questions or would like to proceed.\n\n` +
      `Best regards,\n${profile?.company_name ?? "Your Fence Company"}\n${profile?.phone ?? ""}`
    );

    const mailtoUrl = `mailto:${clientEmail}?subject=${subject}&body=${body}`;

    if (Platform.OS === "web") {
      window.open(mailtoUrl, "_self");
    } else {
      Linking.openURL(mailtoUrl);
    }
  }, [currencySymbol, profile, quote]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Initial paywall check when entitlements become ready
  useEffect(() => {
    if (!isEntitlementsReady || paywallCheckedRef.current || loading) return;
    paywallCheckedRef.current = true;

    // Pro users can always proceed
    if (isPro) return;

    // Check free limit for non-pro users
    (async () => {
      const { data, error } = await supabase.rpc("sent_quotes_this_month");
      if (error) return; // fail open
      const sentCount = Number(data ?? 0);
      if (sentCount >= 3) {
        router.replace({
          pathname: "/(app)/paywall",
          params: { returnTo: "pdfPreview", quoteId: quoteId ?? "" },
        });
      }
    })();
  }, [isEntitlementsReady, isPro, loading, quoteId]);

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

          {!isPdfGenerationAvailable() && (
            <View className="mt-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
              <Text className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Expo Go Mode
              </Text>
              <Text className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                PDF generation requires a development build. You can preview the quote as HTML.
              </Text>
            </View>
          )}
        </View>

        {/* HTML Preview (when PDF not available) */}
        {showPreview && previewHtml && (
          <View className="mb-4">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-lg font-semibold text-gray-900 dark:text-white">
                Quote Preview
              </Text>
              <Pressable onPress={() => setShowPreview(false)}>
                <Text className="text-blue-600 dark:text-blue-400">Hide</Text>
              </Pressable>
            </View>
            <View className="h-96 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              {Platform.OS === "web" ? (
                <iframe
                  srcDoc={previewHtml}
                  style={{ width: "100%", height: "100%", border: "none" }}
                  title="Quote Preview"
                />
              ) : WebView ? (
                <WebView
                  source={{ html: previewHtml }}
                  style={{ flex: 1 }}
                  scrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-gray-500 dark:text-gray-400">
                    Preview not available
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View className="gap-3 mb-6">
          {Platform.OS === "web" ? (
            /* Web: Download PDF via browser print - Primary */
            <Pressable
              className={`rounded-lg items-center justify-center ${
                busy ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
              }`}
              style={{ height: 48 }}
              onPress={handleWebDownloadPdf}
              disabled={busy}
            >
              <Text className="text-white text-center font-semibold text-base">
                Download PDF
              </Text>
            </Pressable>
          ) : (
            /* Native: Generate PDF via react-native-html-to-pdf - Primary */
            <Pressable
              className={`rounded-lg items-center justify-center ${
                busy ? "bg-blue-400" : "bg-blue-600 active:bg-blue-700"
              }`}
              style={{ height: 48 }}
              onPress={handleGenerate}
              disabled={busy}
            >
              <Text className="text-white text-center font-semibold text-base">
                {pdfPath ? "Regenerate PDF" : "Generate PDF"}
              </Text>
            </Pressable>
          )}

          {Platform.OS === "web" ? (
            /* Web: Send email via mailto link - Secondary */
            <Pressable
              className={`rounded-lg items-center justify-center border ${
                busy ? "border-gray-200 dark:border-gray-700" : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              onPress={handleWebSendEmail}
              disabled={busy}
            >
              <Text className="text-gray-700 dark:text-gray-300 text-center font-medium text-base">
                Send Email
              </Text>
            </Pressable>
          ) : (
            /* Native: Send via Edge Function - Secondary */
            <Pressable
              className={`rounded-lg items-center justify-center border ${
                busy || !pdfPath ? "border-gray-200 dark:border-gray-700" : "border-gray-300 dark:border-gray-600"
              }`}
              style={{ height: 48 }}
              onPress={handleSendEmail}
              disabled={busy || !pdfPath}
            >
              <Text className={`text-center font-medium text-base ${
                busy || !pdfPath ? "text-gray-400 dark:text-gray-600" : "text-gray-700 dark:text-gray-300"
              }`}>
                Send Email
              </Text>
            </Pressable>
          )}

          {/* Share button - native only - Secondary */}
          {Platform.OS !== "web" && (
            <Pressable
              className={`rounded-lg items-center justify-center border ${
                busy
                  ? "border-gray-200 dark:border-gray-700"
                  : "border-gray-300 dark:border-gray-600 active:bg-gray-100 dark:active:bg-gray-800"
              }`}
              style={{ height: 48 }}
              onPress={handleShare}
              disabled={busy}
            >
              <Text className="text-gray-700 dark:text-gray-300 text-center font-medium text-base">
                Share
              </Text>
            </Pressable>
          )}
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
