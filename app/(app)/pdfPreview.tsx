// app/(app)/pdfPreview.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, Text, TouchableOpacity, View } from "react-native";

import { generateQuotePdf, QuoteVariant, VariantType } from "@/lib/pdf";
import { sendQuoteEmail, sendQuoteSms } from "@/lib/send";
import { quotePdfPath, uploadPdfToBucket } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

// Если у тебя свои хуки useAuth/useEntitlements — замени тут.
// Я делаю минимально, чтобы было понятно что куда.
type QuoteRow = {
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
};

type ProfileRow = {
  id: string;
  company_name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  currency: string;
};

type SettingsRow = {
  user_id: string;
  terms_template: string;
};

function btnClass(disabled?: boolean) {
  return `px-4 py-3 rounded-xl ${disabled ? "bg-zinc-300" : "bg-black"} `;
}

function btnTextClass(disabled?: boolean) {
  return `text-white font-bold ${disabled ? "opacity-70" : "opacity-100"}`;
}

export default function PdfPreviewScreen() {
  const router = useRouter();
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
  const [isPro, _setIsPro] = useState(false);

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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
        <Text className="mt-2 text-zinc-600">Loading…</Text>
      </View>
    );
  }

  if (!quote || !profile || !settings) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-lg font-bold">Nothing to preview</Text>
        <Text className="mt-2 text-zinc-600 text-center">We could not load this quote.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}>
      <View className="mb-3">
        <Text className="text-2xl font-extrabold">PDF Preview</Text>
        <Text className="mt-1 text-zinc-600">
          Quote for <Text className="font-semibold text-zinc-900">{quote.client_name}</Text>
        </Text>
      </View>

      <View className="rounded-2xl border border-zinc-200 p-4">
        <Text className="text-sm text-zinc-600">Selected option</Text>
        <Text className="mt-1 text-lg font-bold">
          {quote.selected_variant === "budget" ? "Budget" : quote.selected_variant === "premium" ? "Premium" : "Standard"}
        </Text>

        <Text className="mt-3 text-sm text-zinc-600">PDF status</Text>
        <Text className="mt-1 font-semibold">
          {pdfPath ? "Uploaded to storage" : pdfFileUri ? "Generated locally" : "Not generated yet"}
        </Text>

        {!isPro && (
          <View className="mt-3 rounded-xl bg-zinc-100 p-3">
            <Text className="text-sm font-semibold">Free plan</Text>
            <Text className="mt-1 text-sm text-zinc-600">
              Watermark will be included. Sending is limited to 3 quotes/month.
            </Text>
          </View>
        )}
      </View>

      <View className="mt-4 gap-3">
        <TouchableOpacity
          disabled={busy}
          onPress={handleGenerate}
          className={btnClass(busy)}
        >
          <Text className={btnTextClass(busy)}>Generate PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={busy}
          onPress={handleSendEmail}
          className={btnClass(busy)}
        >
          <Text className={btnTextClass(busy)}>Send Email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={busy}
          onPress={handleSendSms}
          className={btnClass(busy)}
        >
          <Text className={btnTextClass(busy)}>Send SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          disabled={busy}
          onPress={handleShare}
          className={`px-4 py-3 rounded-xl border border-zinc-300 ${busy ? "opacity-70" : "opacity-100"}`}
        >
          <Text className="text-zinc-900 font-bold">Share</Text>
        </TouchableOpacity>
      </View>

      {busy && (
        <View className="mt-5 flex-row items-center gap-2">
          <ActivityIndicator />
          <Text className="text-zinc-600">Working…</Text>
        </View>
      )}
    </ScrollView>
  );
}
