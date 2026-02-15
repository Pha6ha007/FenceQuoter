// @ts-nocheck - Deno runtime
export function badRequest(code: string, message: string) {
    return { ok: false, error: { code, message } };
  }
  
  export function isEmail(s: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }
  
  // Simple E.164 check (good enough for MVP)
  export function isE164Phone(s: string) {
    return /^\+[1-9]\d{7,14}$/.test(s);
  }
  