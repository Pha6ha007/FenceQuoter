// lib/send.ts
type SupabaseClient = any;

type SendEmailParams = {
  quote_id: string;
  to?: string;
  subject?: string;
  message?: string;
};

type SendSmsParams = {
  quote_id: string;
  to?: string;       // E.164
  message?: string;  // may include {{link}}
};

function pickErrorMessage(err: unknown) {
  if (!err) return "Something went wrong";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err && "message" in err) return String((err as any).message);
  return "Something went wrong";
}

export async function sendQuoteEmail(supabase: SupabaseClient, params: SendEmailParams) {
  const { data, error } = await supabase.functions.invoke("send-email", { body: params });
  if (error) throw new Error(pickErrorMessage(error));
  if (!data?.ok) throw new Error(data?.error?.message ?? "Failed to send email");
  return data.data as { provider: string; message_id: string | null; quote_id: string; sent_to: string };
}

export async function sendQuoteSms(supabase: SupabaseClient, params: SendSmsParams) {
  const { data, error } = await supabase.functions.invoke("send-sms", { body: params });
  if (error) throw new Error(pickErrorMessage(error));
  if (!data?.ok) throw new Error(data?.error?.message ?? "Failed to send SMS");
  return data.data as { provider: string; message_sid: string | null; quote_id: string; sent_to: string };
}
