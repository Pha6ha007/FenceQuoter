// @ts-nocheck - Deno runtime, not checked by Expo TypeScript
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getServiceClient, getUserFromAuthHeader } from "../_shared/supabase.ts";
import { badRequest, isE164Phone } from "../_shared/validate.ts";

type Body = {
  quote_id: string;
  to?: string;       // E.164
  message?: string;  // may include {{link}}
};

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  if (req.method !== "POST") {
    return new Response(JSON.stringify(badRequest("METHOD_NOT_ALLOWED", "Use POST")), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { user, error: authError } = await getUserFromAuthHeader(req);
  if (!user) {
    return new Response(JSON.stringify(badRequest("UNAUTHORIZED", authError ?? "Unauthorized")), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify(badRequest("BAD_JSON", "Invalid JSON")), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.quote_id) {
    return new Response(JSON.stringify(badRequest("VALIDATION_ERROR", "quote_id is required")), {
      status: 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = getServiceClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("id,user_id,client_name,client_phone,pdf_url")
    .eq("id", body.quote_id)
    .single();

  if (qErr || !quote) {
    return new Response(JSON.stringify(badRequest("NOT_FOUND", "Quote not found")), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (quote.user_id !== user.id) {
    return new Response(JSON.stringify(badRequest("FORBIDDEN", "Not your quote")), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const path = quote.pdf_url; // "<user_id>/<quote_id>.pdf" in quote-pdfs bucket
  if (!path) {
    return new Response(JSON.stringify(badRequest("PDF_MISSING", "Quote PDF is missing")), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = (body.to ?? quote.client_phone ?? "").trim();
  if (!to || !isE164Phone(to)) {
    return new Response(JSON.stringify(badRequest("VALIDATION_ERROR", "Valid E.164 phone is required, e.g. +14155550123")), {
      status: 422,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Signed URL (7 days)
  const { data: signed, error: sErr } = await supabase.storage
    .from("quote-pdfs")
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (sErr || !signed?.signedUrl) {
    return new Response(JSON.stringify(badRequest("SIGNED_URL_FAILED", "Failed to create signed URL")), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");
  if (!sid || !token || !from) {
    return new Response(JSON.stringify(badRequest("MISSING_SECRETS", "Missing Twilio secrets")), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const tmpl = body.message?.trim() || `Hi ${quote.client_name || ""}, your quote is ready: {{link}}`;
  const text = tmpl.includes("{{link}}") ? tmpl.replaceAll("{{link}}", signed.signedUrl) : `${tmpl}\n${signed.signedUrl}`;

  const form = new URLSearchParams();
  form.set("From", from);
  form.set("To", to);
  form.set("Body", text);

  const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(`${sid}:${token}`),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  if (!twilioResp.ok) {
    const raw = await twilioResp.text().catch(() => "");
    return new Response(JSON.stringify(badRequest("PROVIDER_ERROR", `Twilio error: ${raw || twilioResp.status}`)), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await twilioResp.json().catch(() => ({}));

  await supabase
    .from("quotes")
    .update({ status: "sent", sent_via: "sms", sent_at: new Date().toISOString() })
    .eq("id", quote.id);

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        provider: "twilio",
        message_sid: payload?.sid ?? null,
        quote_id: quote.id,
        sent_to: to,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
