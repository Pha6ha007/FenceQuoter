// @ts-nocheck - Deno runtime, not checked by Expo TypeScript
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { getServiceClient, getUserFromAuthHeader } from "../_shared/supabase.ts";
import { badRequest, isEmail } from "../_shared/validate.ts";

type Body = {
  quote_id: string;
  to?: string;
  subject?: string;
  message?: string;
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
    .select("id,user_id,client_name,client_email,pdf_url,status")
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

  const path = quote.pdf_url; // IMPORTANT: storage path in quote-pdfs bucket: "<user_id>/<quote_id>.pdf"
  if (!path) {
    return new Response(JSON.stringify(badRequest("PDF_MISSING", "Quote PDF is missing")), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const to = (body.to ?? quote.client_email ?? "").trim();
  if (!to || !isEmail(to)) {
    return new Response(JSON.stringify(badRequest("VALIDATION_ERROR", "Valid to email is required")), {
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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const RESEND_FROM = Deno.env.get("RESEND_FROM");
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return new Response(JSON.stringify(badRequest("MISSING_SECRETS", "Missing RESEND_API_KEY or RESEND_FROM")), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const subject = body.subject?.trim() || "Your Fence Quote";
  const message = body.message?.trim() || `Hi ${quote.client_name || ""}, your quote is ready.`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.4">
      <p>${escapeHtml(message)}</p>
      <p><a href="${signed.signedUrl}">Open your quote (PDF)</a></p>
      <p style="color:#666;font-size:12px">Sent via FenceQuoter</p>
    </div>
  `;

  const resendResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      html,
    }),
  });

  if (!resendResp.ok) {
    const text = await resendResp.text().catch(() => "");
    return new Response(JSON.stringify(badRequest("PROVIDER_ERROR", `Resend error: ${text || resendResp.status}`)), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const payload = await resendResp.json().catch(() => ({}));

  await supabase
    .from("quotes")
    .update({ status: "sent", sent_via: "email", sent_at: new Date().toISOString() })
    .eq("id", quote.id);

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        provider: "resend",
        message_id: payload?.id ?? null,
        quote_id: quote.id,
        sent_to: to,
      },
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
