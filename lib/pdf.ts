// lib/pdf.ts
// PDF generation requires development build (eas build --profile development)
// In Expo Go, native modules are unavailable — we return HTML for WebView preview instead.

import { Platform } from "react-native";

// Dynamic import for native-only library (not available in Expo Go)
type GeneratePDFFunc = (options: { html: string; fileName: string; base64: boolean }) => Promise<{ filePath?: string } | null>;
let generatePDF: GeneratePDFFunc | null = null;
let pdfModuleAvailable = false;

if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfModule = require("react-native-html-to-pdf");
    generatePDF = pdfModule.generatePDF;
    pdfModuleAvailable = true;
  } catch {
    // Module not available (Expo Go) — will use HTML fallback
    console.warn("[pdf] react-native-html-to-pdf not available. Using HTML preview mode.");
  }
}

export function isPdfGenerationAvailable(): boolean {
  return pdfModuleAvailable && Platform.OS !== "web";
}

export type VariantType = "budget" | "standard" | "premium";

export type QuoteItemCategory = "material" | "labor" | "removal" | "custom";

export interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  category?: QuoteItemCategory; // optional because some older JSON may omit it
}

export interface QuoteVariant {
  type: VariantType;
  markup_percent: number;
  items: QuoteItem[];
  subtotal: number;
  markup_amount: number;
  tax_amount: number;
  total: number;
  materials_total?: number;
  labor_total?: number;
}

export interface QuotePdfInput {
  quoteId: string;
  createdAtISO: string;

  // Company
  companyName: string;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl?: string | null; // public URL (logos bucket public)

  // Client
  clientName: string;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;

  // Quote
  selectedVariant: VariantType;
  variants: QuoteVariant[];

  // PDF options
  termsTemplate?: string | null;
  currencySymbol: string; // e.g. "$", "£"
  freeWatermark: boolean;

  // Photos (optional)
  // NOTE: For MVP we include photo LINKS (not embedded) because embedding requires base64.
  // You can later extend to embed base64 thumbnails.
  photoUrls?: string[];
}

export interface GeneratePdfResult {
  filePath: string | null;  // local pdf file uri/path (null if PDF module unavailable)
  fileName: string;         // e.g. FenceQuoter-Quote-<id>.pdf
  html: string;             // HTML content for WebView fallback
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<GeneratePdfResult> {
  const variant = pickVariant(input.variants, input.selectedVariant);

  const fileName = `FenceQuoter-Quote-${safeId(input.quoteId)}.pdf`;

  const html = buildHtml({
    ...input,
    variant,
  });

  // Web platform or Expo Go: return HTML for WebView preview (PDF module unavailable)
  if (Platform.OS === "web" || !generatePDF || !pdfModuleAvailable) {
    return { filePath: null, fileName, html };
  }

  // Native with PDF module available
  try {
    const options = {
      html,
      fileName: fileName.replace(/\.pdf$/i, ""),
      base64: false,
    };

    const res = await generatePDF(options);
    if (!res?.filePath) {
      // Fallback to HTML if PDF generation fails
      console.warn("[pdf] PDF generation returned no filePath, using HTML fallback");
      return { filePath: null, fileName, html };
    }

    return { filePath: res.filePath, fileName, html };
  } catch (error) {
    // Fallback to HTML on error
    console.warn("[pdf] PDF generation failed, using HTML fallback:", error);
    return { filePath: null, fileName, html };
  }
}

// -------------------- HTML builder --------------------

function buildHtml(params: QuotePdfInput & { variant: QuoteVariant }) {
  const {
    quoteId,
    createdAtISO,
    companyName,
    companyPhone,
    companyEmail,
    logoUrl,
    clientName,
    clientAddress,
    clientEmail,
    clientPhone,
    selectedVariant,
    variants,
    termsTemplate,
    currencySymbol,
    freeWatermark,
    photoUrls,
    variant,
  } = params;

  const dateStr = formatDate(createdAtISO);

  const variantLabel = labelVariant(selectedVariant);

  const itemsByCategory = groupItems(variant.items);

  const materialsRows = renderRows(itemsByCategory.material, currencySymbol);
  const laborRows = renderRows(itemsByCategory.labor, currencySymbol);
  const removalRows = renderRows(itemsByCategory.removal, currencySymbol);
  const customRows = renderRows(itemsByCategory.custom, currencySymbol);

  const totals = {
    subtotal: money(currencySymbol, variant.subtotal),
    markup: money(currencySymbol, variant.markup_amount),
    tax: money(currencySymbol, variant.tax_amount),
    total: money(currencySymbol, variant.total),
  };

  const allVariantSummary = renderVariantSummary(variants, currencySymbol, selectedVariant);

  const terms = (termsTemplate ?? "").trim() || "This quote is valid for 30 days. Material prices may vary.";

  const photosBlock = (photoUrls && photoUrls.length > 0)
    ? `
      <div class="section">
        <div class="section-title">Project photos</div>
        <div class="photos">
          ${photoUrls.slice(0, 5).map((u) => `<a class="photo-link" href="${escapeHtml(u)}">${escapeHtml(shorten(u))}</a>`).join("")}
        </div>
      </div>
    `
    : "";

  // Watermark via CSS background overlay
  const watermarkCss = freeWatermark
    ? `
      <div class="watermark">Created with FenceQuoter</div>
    `
    : "";

  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 28px;
    }
    .page {
      position: relative;
      width: 100%;
      min-height: 100%;
    }
    .watermark {
      position: fixed;
      top: 42%;
      left: 10%;
      right: 10%;
      text-align: center;
      font-size: 46px;
      color: rgba(0,0,0,0.08);
      transform: rotate(-18deg);
      z-index: 0;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 18px;
      z-index: 1;
      position: relative;
    }
    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .logo {
      max-height: 60px;
      max-width: 120px;
      border-radius: 10px;
      object-fit: contain;
      border: 1px solid #eee;
    }
    .company-name {
      font-size: 18px;
      font-weight: 700;
      margin: 0;
    }
    .company-meta {
      font-size: 12px;
      color: #444;
      margin-top: 2px;
      line-height: 1.3;
    }
    .quote-meta {
      text-align: right;
      font-size: 12px;
      color: #444;
      line-height: 1.4;
      min-width: 160px;
    }
    .badge {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      background: #111;
      color: #fff;
      margin-top: 6px;
    }
    .divider {
      height: 1px;
      background: #eee;
      margin: 14px 0 18px;
    }
    .grid {
      display: flex;
      gap: 18px;
      margin-bottom: 18px;
    }
    .card {
      flex: 1;
      border: 1px solid #eee;
      border-radius: 12px;
      padding: 12px 14px;
      background: #fff;
      z-index: 1;
      position: relative;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: #666;
      margin: 0 0 6px 0;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .card-body {
      font-size: 13px;
      line-height: 1.35;
    }
    .muted { color: #666; }
    table {
      width: 100%;
      border-collapse: collapse;
      z-index: 1;
      position: relative;
      background: #fff;
    }
    th, td {
      padding: 9px 8px;
      border-bottom: 1px solid #eee;
      font-size: 12px;
      vertical-align: top;
    }
    th {
      text-align: left;
      color: #666;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      font-size: 11px;
    }
    td.num, th.num { text-align: right; white-space: nowrap; }
    .section { margin-top: 18px; z-index: 1; position: relative; }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #111;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.35px;
    }
    .totals {
      margin-top: 10px;
      width: 100%;
      display: flex;
      justify-content: flex-end;
    }
    .totals-box {
      width: 280px;
      border: 1px solid #eee;
      border-radius: 12px;
      padding: 12px 14px;
      background: #fff;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      padding: 4px 0;
      color: #222;
    }
    .totals-row.total {
      font-size: 24px;
      font-weight: bold;
      padding-top: 12px;
      border-top: 2px solid #333;
      margin-top: 8px;
    }
    .terms {
      font-size: 11px;
      color: #444;
      line-height: 1.4;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: #777;
      text-align: center;
    }
    .photos { display: flex; flex-direction: column; gap: 6px; }
    .photo-link { font-size: 11px; color: #111; text-decoration: underline; word-break: break-all; }
  </style>
</head>
<body>
  <div class="page">
    ${watermarkCss}

    <div class="header">
      <div class="brand">
        ${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" />` : ""}
        <div>
          <p class="company-name">${escapeHtml(companyName)}</p>
          <div class="company-meta">
            ${companyPhone ? `<div>${escapeHtml(formatPhone(companyPhone))}</div>` : ""}
            ${companyEmail ? `<div>${escapeHtml(companyEmail)}</div>` : ""}
          </div>
        </div>
      </div>

      <div class="quote-meta">
        <div><b>Quote</b> ${escapeHtml(shortId(quoteId))}</div>
        <div>${escapeHtml(dateStr)}</div>
        <div class="badge">${escapeHtml(variantLabel)}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Bill to</div>
        <div class="card-body">
          <div><b>${escapeHtml(clientName)}</b></div>
          ${clientAddress ? `<div class="muted">${escapeHtml(clientAddress)}</div>` : ""}
          ${clientEmail ? `<div class="muted">${escapeHtml(clientEmail)}</div>` : ""}
          ${clientPhone ? `<div class="muted">${escapeHtml(formatPhone(clientPhone))}</div>` : ""}
        </div>
      </div>

      <div class="card">
        <div class="card-title">Options</div>
        <div class="card-body">
          ${allVariantSummary}
          <div style="margin-top:8px" class="muted">
            Selected: <b>${escapeHtml(variantLabel)}</b>
          </div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Line items</div>

      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Qty</th>
            <th class="num">Unit price</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${materialsRows ? `<tr><td colspan="4" style="padding-top:14px"><b>Materials</b></td></tr>${materialsRows}` : ""}
          ${laborRows ? `<tr><td colspan="4" style="padding-top:14px"><b>Labor</b></td></tr>${laborRows}` : ""}
          ${removalRows ? `<tr><td colspan="4" style="padding-top:14px"><b>Removal</b></td></tr>${removalRows}` : ""}
          ${customRows ? `<tr><td colspan="4" style="padding-top:14px"><b>Custom</b></td></tr>${customRows}` : ""}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-box">
          <div class="totals-row"><span>Subtotal</span><span>${totals.subtotal}</span></div>
          <div class="totals-row"><span>Markup</span><span>${totals.markup}</span></div>
          <div class="totals-row"><span>Tax</span><span>${totals.tax}</span></div>
          <div class="totals-row total"><span>Total</span><span>${totals.total}</span></div>
        </div>
      </div>
    </div>

    ${photosBlock}

    <div class="section">
      <div class="section-title">Terms</div>
      <div class="terms">${escapeHtml(terms)}</div>
    </div>

    <div class="footer">
      Quote valid for 30 days • Generated with FenceQuoter
    </div>
  </div>
</body>
</html>
`;
}

// -------------------- helpers --------------------

function pickVariant(variants: QuoteVariant[], type: VariantType): QuoteVariant {
  const v = variants.find((x) => x.type === type) ?? variants.find((x) => x.type === "standard");
  if (!v) throw new Error("No variants to render");
  return v;
}

function labelVariant(type: VariantType) {
  if (type === "budget") return "Budget";
  if (type === "premium") return "Premium";
  return "Standard";
}

function groupItems(items: QuoteItem[]) {
  const out: Record<string, QuoteItem[]> = {
    material: [],
    labor: [],
    removal: [],
    custom: [],
  };

  for (const it of items ?? []) {
    const cat = (it.category ?? "material") as QuoteItemCategory;
    if (cat === "labor") out.labor.push(it);
    else if (cat === "removal") out.removal.push(it);
    else if (cat === "custom") out.custom.push(it);
    else out.material.push(it);
  }

  return out as {
    material: QuoteItem[];
    labor: QuoteItem[];
    removal: QuoteItem[];
    custom: QuoteItem[];
  };
}

function renderRows(items: QuoteItem[], currencySymbol: string) {
  if (!items || items.length === 0) return "";

  return items
    .map((it) => {
      const qty = formatQty(it.qty);
      const unitPrice = money(currencySymbol, it.unit_price);
      const total = money(currencySymbol, it.total);
      const unit = (it.unit || "").trim();

      const qtyLabel = unit ? `${qty} ${escapeHtml(unit)}` : qty;

      return `
        <tr>
          <td>${escapeHtml(it.name)}</td>
          <td class="num">${qtyLabel}</td>
          <td class="num">${unitPrice}</td>
          <td class="num"><b>${total}</b></td>
        </tr>
      `;
    })
    .join("");
}

function renderVariantSummary(variants: QuoteVariant[], currencySymbol: string, selected: VariantType) {
  const order: VariantType[] = ["budget", "standard", "premium"];

  const map = new Map<VariantType, QuoteVariant>();
  for (const v of variants ?? []) map.set(v.type, v);

  return `
    <div style="display:flex; flex-direction:column; gap:6px;">
      ${order
        .map((t) => {
          const v = map.get(t);
          if (!v) return "";
          const isSel = t === selected;
          const label = labelVariant(t);
          const price = money(currencySymbol, v.total);
          return `
            <div style="display:flex; justify-content:space-between; ${isSel ? "font-weight:900;" : ""}">
              <span>${escapeHtml(label)}</span>
              <span>${price}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function money(symbol: string, value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return `${symbol}${n.toFixed(2)}`;
}

function formatQty(n: number) {
  if (!Number.isFinite(n)) return "0";
  // Show up to 2 decimals, trim trailing zeros
  const s = n.toFixed(2);
  return s.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatDate(iso: string) {
  // Keep it simple and stable (no locale surprises inside PDF engines)
  try {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return iso;
  }
}

function escapeHtml(s: string) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeId(id: string) {
  return String(id ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "quote";
}

function shortId(id: string) {
  const s = String(id ?? "");
  if (s.length <= 8) return s;
  return s.slice(0, 8).toUpperCase();
}

function shorten(url: string) {
  if (url.length <= 50) return url;
  return url.slice(0, 28) + "..." + url.slice(-16);
}

/**
 * Format phone number for display
 * US format: "2933364565" → "(293) 336-4565"
 * International: "+12933364565" → "+1 293 336 4565"
 * Other: return as-is with basic cleanup
 */
function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";

  // Remove all non-digit characters except leading +
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (!digits) return phone;

  // US format: 10 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // US with country code: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // International format: group in 3s with + prefix
  if (hasPlus || digits.length > 10) {
    const groups: string[] = [];
    let remaining = digits;

    // Country code (1-3 digits)
    if (remaining.length > 10) {
      const countryCodeLen = remaining.length - 10;
      groups.push(remaining.slice(0, countryCodeLen));
      remaining = remaining.slice(countryCodeLen);
    }

    // Rest in groups of 3-4
    while (remaining.length > 0) {
      if (remaining.length <= 4) {
        groups.push(remaining);
        break;
      }
      groups.push(remaining.slice(0, 3));
      remaining = remaining.slice(3);
    }

    return "+" + groups.join(" ");
  }

  // Fallback: return cleaned up version
  return phone.trim();
}
