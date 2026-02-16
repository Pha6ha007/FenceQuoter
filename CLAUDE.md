# FenceQuoter — CLAUDE.md

## 0. Контекст

FenceQuoter — мобильное приложение (iOS + Android + Web) для fence contractors.
Подрядчик вводит параметры объекта → система считает материалы + работу → показывает 3 варианта (Budget / Standard / Premium) → генерирует брендированный PDF → отправляет клиенту по email/SMS.

Цель MVP: полный flow `register → onboarding → new quote → calculate → pdf → send → history`.
Монетизация: freemium (3 отправленных квоута/мес бесплатно, Pro = $49/мес).

---

## 1. Стек (фиксирован, не менять)

| Слой | Технология | Версия |
|------|-----------|--------|
| Framework | Expo SDK | 52+ |
| Language | TypeScript | strict, no `any` |
| Router | Expo Router | file-based |
| Styling | NativeWind | v4 (Tailwind для RN) |
| Backend | Supabase | Auth + Postgres + Storage + Edge Functions |
| Subscriptions | RevenueCat | react-native-purchases |
| PDF | react-native-html-to-pdf | — |
| Email | Resend | через Supabase Edge Function |
| SMS | Twilio | через Supabase Edge Function |
| Analytics | PostHog (react-native) | — |

---

## 2. Правила кода (строго соблюдать)

### Общие
- TypeScript strict, никаких `any`, каждый компонент имеет `Props` interface
- Компоненты только функциональные + хуки
- Стили только через NativeWind классы, никаких StyleSheet.create
- Один файл = один экспортируемый компонент/хук/утилита
- Изменения маленькими шагами: один экран или одна фича за раз
- После каждого изменения — убедиться что существующий flow не сломан

### Архитектура
- Бизнес-логика расчётов: строго в `lib/calculator.ts` (чистые функции, без side effects)
- Supabase клиент: `lib/supabase.ts` (единственное место инициализации)
- Сетевые запросы: только через хуки в `hooks/`
- Валидация: `lib/validation.ts` (Zod-схемы)
- Константы/дефолты: `constants/` (никаких magic numbers в компонентах)

### Тесты
- `lib/calculator.ts` — обязательно unit-тесты (каждый тип забора)
- `lib/validation.ts` — обязательно unit-тесты
- Остальное — по необходимости

### Ошибки и офлайн
- ВСЕ сетевые вызовы обёрнуты в try/catch
- При ошибке сети — user-friendly Alert, не crash
- Форма квоута работает офлайн: данные сохраняются в AsyncStorage каждые 5 секунд
- При появлении сети — синхронизация с Supabase
- Хук `useNetworkStatus` для отслеживания состояния сети
- Хук `useOfflineQuote` для AsyncStorage draft

---

## 3. Навигационный flow

```
                    ┌─ has profile? ─── YES ──→ /(app)/history
register/login ────→│
                    └─ NO ──────────→ /(app)/onboarding ──→ /(app)/history

/(app)/history ──→ "+" button ──→ /(app)/newQuote
                                        │
                                        ▼
                                  /(app)/results
                                        │
                                        ▼
                                 /(app)/pdfPreview
                                     │       │
                              "Send" │       │ "Save draft"
                                     ▼       ▼
                              /(app)/history

/(app)/history ──→ tap quote ──→ /(app)/results (read-only если sent)

Paywall check: перед генерацией PDF на /(app)/pdfPreview
  - если free && sent_this_month >= 3 → показать /(app)/paywall
  - paywall → purchase → return to pdfPreview
```

### Guards
- `(app)/*` — требует auth (redirect на login если нет сессии)
- `newQuote` → свободный доступ (пусть считает бесплатно)
- `pdfPreview` → paywall проверка (блокируем отправку, не расчёт)

---

## 4. Экраны MVP

### 4.1 Auth — `(auth)/login.tsx`, `register.tsx`, `resetPassword.tsx`
- Email + password (Supabase Auth)
- Google Sign-In, Apple Sign-In (через Supabase OAuth)
- Deep link для email verification (scheme: `fencequoter`)
- "Forgot password" flow
- Минимум полей: email, password. Остальное — в onboarding.

### 4.2 Onboarding — `(app)/onboarding.tsx`
- company_name (required)
- phone (required)
- logo (optional, камера или галерея → Supabase Storage `logos/<user_id>/logo.<ext>`)
- region picker: US / UK / CA / AU / EU / Other
- currency (автоматически по региону, но можно сменить)
- unit_system: imperial (ft, in) / metric (m, cm) — автоматически по региону
- hourly_rate (required, default по региону — см. секцию 9)
- default_markup_percent (default: 20)
- tax_percent (default: 0, подсказка "Sales tax if applicable")
- Кнопка "Start Quoting →"
- При сохранении: update profile + settings + вызвать `supabase.rpc('seed_materials_for_user')`

### 4.3 New Quote — `(app)/newQuote.tsx`
**Клиентская секция:**
- client_name (required)
- client_phone (optional)
- client_email (optional)
- address (optional, text)

**Параметры забора:**
- fence_type: picker из `['wood_privacy', 'wood_picket', 'chain_link', 'vinyl', 'aluminum']`
- length: number (ft или m, зависит от unit_system)
- height: picker из стандартных для типа (например wood_privacy: 4ft, 5ft, 6ft, 8ft)
- gates_standard: number (default 0, stepper +/-)
- gates_large: number (default 0, stepper +/-, "double/driveway gate")
- remove_old: toggle (default false)
- terrain: picker `['flat', 'slight_slope', 'steep_slope', 'rocky']`
- notes: textarea (optional)
- photos: до 5 фото (камера/галерея → Storage `quote-photos/<user_id>/<quote_id>/<uuid>.<ext>`)

**UX:**
- Автосохранение в AsyncStorage каждые 5 секунд (офлайн-safe)
- Кнопка "Calculate →" внизу
- Валидация перед переходом (length > 0, fence_type selected, client_name not empty)

### 4.4 Results — `(app)/results.tsx`
- 3 карточки: Budget / Standard / Premium
  - Каждая показывает: total, разбивку (materials, labor, markup, tax)
  - Визуальное выделение Standard как рекомендованного
- Tap на карточку → раскрывается детальная разбивка (список items)
- Кнопка "Add custom item" → модалка (name, qty, unit_price)
- Кнопка "Edit markup" → slider или input (%)
- Кнопка "Generate PDF →" для выбранного варианта
- При нажатии → сохранить quote в Supabase → navigate to pdfPreview

### 4.5 PDF Preview — `(app)/pdfPreview.tsx`
- **PAYWALL CHECK при входе на экран** (rpc `sent_quotes_this_month`)
- Генерация PDF из HTML-шаблона (react-native-html-to-pdf)
- Шаблон: логотип, контакты компании, клиент, разбивка, условия, дата
- Free: watermark "Created with FenceQuoter"
- Upload PDF → Storage `quote-pdfs/<user_id>/<quote_id>.pdf`
- Сохранить path (не URL!) в `quotes.pdf_url`
- Кнопки: "Send Email", "Send SMS", "Share" (native share), "Download"

### 4.6 History — `(app)/history.tsx`
- Список квоутов, сортировка по дате (newest first)
- Каждая карточка: client_name, date, total, status badge
- Фильтр-табы: All | Draft | Sent | Accepted | Rejected
- Swipe left → delete (с подтверждением)
- Tap → navigate to results (read-only если status != draft)
- FAB кнопка "+" → newQuote
- Пустое состояние: иллюстрация + "Create your first quote"

### 4.7 Settings — `(app)/settings.tsx`
- **Company:** name, phone, logo (edit)
- **Pricing:** hourly_rate, default_markup_percent, tax_percent
- **Materials:** список материалов с ценами (tap → edit price)
- **Terms:** textarea с шаблоном условий для PDF
- **Subscription:** текущий план, manage/upgrade, restore purchases
- **Account:** email, change password, logout, delete account
- **About:** version, support email, privacy policy, terms of service

### 4.8 Paywall — `(app)/paywall.tsx`
- Показывает когда free-лимит исчерпан (3 отправленных квоутов/мес)
- Лимит: `supabase.rpc('sent_quotes_this_month')` >= 3
- Считается по `status = 'sent'` (не черновики) в текущем месяце
- Преимущества Pro: unlimited quotes, no watermark, SMS sending, priority support
- Кнопки: "$49/month" и "$39/month (billed yearly)"
- Кнопка "Restore Purchases" (ОБЯЗАТЕЛЬНА для Apple)
- RevenueCat: offerings → purchase → verify entitlement → redirect back

---

## 5. База данных (Supabase)

### Таблицы

```sql
profiles (id = auth.uid)
  company_name, logo_url, phone, email, region, currency, unit_system

settings (user_id = auth.uid, 1:1)
  hourly_rate, default_markup_percent (int, 20 = 20%), tax_percent (int), terms_template

materials (user_id, fence_type, category)
  name, unit, unit_price, sort_order, is_active
  unique(user_id, fence_type, category, name)

quotes (user_id)
  client_name, client_email, client_phone, client_address (nullable)
  status: draft | calculated | sent | accepted | rejected
  inputs: jsonb (параметры формы)
  variants: jsonb (массив 3 объектов budget/standard/premium с items внутри)
  selected_variant: budget | standard | premium
  custom_items: jsonb
  subtotal, markup_amount, tax_amount, total (denormalized для быстрого отображения в списке)
  pdf_url: text (STORAGE PATH, не URL! формат: <user_id>/<quote_id>.pdf)
  sent_via, sent_at

quote_photos (quote_id, user_id)
  url: text (storage path: <user_id>/<quote_id>/<uuid>.<ext>)
```

### Variants JSONB формат

```json
[
  {
    "type": "budget",
    "markup_percent": 15,
    "items": [
      { "name": "4x4 Post", "qty": 14, "unit": "each", "unit_price": 14.00, "total": 196.00, "category": "material" },
      { "name": "Labor — fence installation", "qty": 15.6, "unit": "hours", "unit_price": 45.00, "total": 702.00, "category": "labor" }
    ],
    "materials_total": 1200.00,
    "labor_total": 702.00,
    "subtotal": 1902.00,
    "markup_amount": 285.30,
    "tax_amount": 0.00,
    "total": 2187.30
  },
  { "type": "standard", "markup_percent": 20, "..." : "..." },
  { "type": "premium", "markup_percent": 30, "..." : "..." }
]
```

### RLS (все таблицы)
- profiles: `id = auth.uid()` — select, insert, update
- settings: `user_id = auth.uid()` — select, insert, update
- materials: `user_id = auth.uid()` — select, insert, update, delete
- quotes: `user_id = auth.uid()` — select, insert, update, delete
- quote_photos: `user_id = auth.uid()` — select, insert, delete

### Storage

| Bucket | Public | Path convention | Назначение |
|--------|--------|----------------|-----------|
| `logos` | YES (read) | `<user_id>/logo.<ext>` | Логотип в PDF и профиле |
| `quote-photos` | NO | `<user_id>/<quote_id>/<uuid>.<ext>` | Фото объекта (до 5 штук) |
| `quote-pdfs` | NO | `<user_id>/<quote_id>.pdf` | Сгенерированные PDF |

**Правила Storage:**
- `logos` — public read, auth write только в папку `auth.uid()/`
- `quote-photos`, `quote-pdfs` — auth read/write, скоуп `name like auth.uid() || '/%'`
- В `quotes.pdf_url` и `quote_photos.url` хранить **path внутри bucket**, не полный URL
- Для отправки клиенту → `createSignedUrl(path, 30 days)` в Edge Function
- Для отображения логотипа → `getPublicUrl(path)` (bucket public)

### Helper RPC functions
- `seed_materials_for_user()` — seed 35 позиций по 5 типам заборов. Вызывать после onboarding.
- `sent_quotes_this_month()` → int — количество sent-квоутов в текущем месяце. Для paywall.

### Auto-triggers
- `handle_new_user()` — при `auth.users INSERT` → создаёт profile + settings автоматически
- `set_updated_at()` — перед UPDATE на profiles, settings, materials, quotes

---

## 6. Расчёт — `lib/calculator.ts`

### Интерфейсы

```typescript
interface QuoteInputs {
  fence_type: FenceType;
  length: number;
  height: number;
  gates_standard: number;
  gates_large: number;
  remove_old: boolean;
  terrain: TerrainType;
}

type FenceType = 'wood_privacy' | 'wood_picket' | 'chain_link' | 'vinyl' | 'aluminum';
type TerrainType = 'flat' | 'slight_slope' | 'steep_slope' | 'rocky';
type VariantType = 'budget' | 'standard' | 'premium';

interface MaterialRecord {
  name: string;
  unit: string;
  unit_price: number;
  category: string; // post | rail | panel | concrete | hardware | gate
}

interface QuoteItem {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
  category: 'material' | 'labor' | 'removal' | 'custom';
}

interface QuoteVariant {
  type: VariantType;
  markup_percent: number;
  items: QuoteItem[];
  materials_total: number;
  labor_total: number;
  subtotal: number;
  markup_amount: number;
  tax_amount: number;
  total: number;
}

interface CalculatorResult {
  variants: QuoteVariant[];
}

interface CalculatorSettings {
  hourly_rate: number;
  default_markup_percent: number; // целое число: 20 = 20%
  tax_percent: number;            // целое число: 8 = 8%
}
```

### Коэффициенты — `constants/coefficients.ts`

```typescript
export const FENCE_SPECS: Record<FenceType, FenceSpec> = {
  wood_privacy: {
    label: 'Wood Privacy',
    post_spacing: 8,        // ft between posts
    rails_per_section: 3,
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.15,
    available_heights: [4, 5, 6, 8],
    default_height: 6,
  },
  wood_picket: {
    label: 'Wood Picket',
    post_spacing: 8,
    rails_per_section: 2,
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.12,
    available_heights: [3, 3.5, 4],
    default_height: 4,
  },
  chain_link: {
    label: 'Chain Link',
    post_spacing: 10,
    rails_per_section: 1,
    concrete_bags_per_post: 0.75,
    labor_hours_per_ft: 0.08,
    available_heights: [4, 5, 6],
    default_height: 4,
  },
  vinyl: {
    label: 'Vinyl',
    post_spacing: 8,
    rails_per_section: 0,
    concrete_bags_per_post: 1,
    labor_hours_per_ft: 0.12,
    available_heights: [4, 5, 6],
    default_height: 6,
  },
  aluminum: {
    label: 'Aluminum',
    post_spacing: 8,
    rails_per_section: 0,
    concrete_bags_per_post: 0.75,
    labor_hours_per_ft: 0.10,
    available_heights: [4, 5, 6],
    default_height: 4,
  },
};

export const TERRAIN_MULTIPLIERS: Record<TerrainType, number> = {
  flat: 1.0,
  slight_slope: 1.15,
  steep_slope: 1.35,
  rocky: 1.5,
};

export const GATE_LABOR_HOURS = {
  standard: 1.5,
  large: 3.0,
};

export const REMOVAL_HOURS_PER_FT = 0.05;

export const PICKETS_PER_FOOT: Partial<Record<FenceType, number>> = {
  wood_privacy: 2.4,
  wood_picket: 1.8,
};

export const VARIANT_MARKUP_MODIFIERS: Record<VariantType, number> = {
  budget: -5,
  standard: 0,
  premium: +10,
};
```

### Seed-данные — `constants/defaults.ts`

```typescript
export const REGIONAL_DEFAULTS: Record<string, RegionalDefault> = {
  US: { currency: 'USD', unit_system: 'imperial', hourly_rate: 45, symbol: '$' },
  CA: { currency: 'CAD', unit_system: 'imperial', hourly_rate: 50, symbol: 'C$' },
  UK: { currency: 'GBP', unit_system: 'metric', hourly_rate: 35, symbol: '£' },
  AU: { currency: 'AUD', unit_system: 'metric', hourly_rate: 55, symbol: 'A$' },
  EU: { currency: 'EUR', unit_system: 'metric', hourly_rate: 40, symbol: '€' },
  Other: { currency: 'USD', unit_system: 'metric', hourly_rate: 30, symbol: '$' },
};

// Seed-данные материалов (35 позиций по 5 типам) хранятся в БД.
// Вызывать supabase.rpc('seed_materials_for_user') после onboarding.
// Подробный список — см. 001_initial.sql
```

### Алгоритм расчёта

```
ВХОД: QuoteInputs + MaterialRecord[] (из БД по fence_type) + CalculatorSettings
ВЫХОД: CalculatorResult (3 варианта)

1. Получить FenceSpec по fence_type из FENCE_SPECS
2. posts = ceil(length / post_spacing) + 1
3. sections = posts - 1
4. Рассчитать количество материалов:
   - posts: posts штук
   - rails: sections * rails_per_section (если > 0)
   - panels/pickets:
     - panel-based (vinyl, aluminum): sections штук
     - chain_link fabric: length ft
     - picket-based (wood_privacy, wood_picket): length * PICKETS_PER_FOOT[type]
   - concrete: posts * concrete_bags_per_post
   - hardware: sections штук
   - gates: gates_standard + gates_large (из materials по category='gate')
5. Сопоставить количества с ценами из MaterialRecord[] по category
6. materials_total = сумма всех материалов
7. Работа:
   - base_hours = length * labor_hours_per_ft
   - gate_hours = gates_standard * 1.5 + gates_large * 3.0
   - removal_hours = remove_old ? length * 0.05 : 0
   - total_hours = (base_hours + gate_hours + removal_hours) * terrain_multiplier
   - labor_total = total_hours * hourly_rate
8. subtotal = materials_total + labor_total
9. Для каждого из 3 вариантов:
   - effective_markup = max(0, default_markup_percent + VARIANT_MARKUP_MODIFIERS[type])
   - markup_amount = subtotal * (effective_markup / 100)
   - tax_amount = (subtotal + markup_amount) * (tax_percent / 100)
   - total = subtotal + markup_amount + tax_amount
10. Вернуть массив из 3 QuoteVariant с items внутри

ФУНКЦИЯ ЧИСТАЯ: без side effects, без Supabase, без сетевых вызовов.
```

---

## 7. Edge Functions

### 7.1 send-email — `supabase/functions/send-email/index.ts`

**Request:**
```json
{
  "quote_id": "uuid",
  "to": "client@example.com",
  "subject": "Your Fence Quote from ABC Fencing",
  "message": "Hi John, please find your quote attached."
}
```

**Response:** `{ "ok": true }` или `{ "ok": false, "error": { "code": "...", "message": "..." } }`

**Скелет:**
```typescript
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

serve(async (req) => {
  try {
    const { quote_id, to, subject, message } = await req.json();

    // 1. Supabase client с auth юзера
    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Fetch quote (RLS гарантирует ownership)
    const { data: quote, error: qErr } = await supabase
      .from("quotes").select("*").eq("id", quote_id).single();
    if (qErr || !quote) return Response.json({ ok: false, error: { code: "NOT_FOUND" } }, { status: 404 });

    // 3. Guard: уже отправлен → не отправлять повторно
    if (quote.status === "sent") {
      return Response.json({ ok: false, error: { code: "ALREADY_SENT" } });
    }

    // 4. Signed URL для PDF (30 дней)
    const { data: signed, error: sErr } = await supabase.storage
      .from("quote-pdfs")
      .createSignedUrl(quote.pdf_url, 60 * 60 * 24 * 30);
    if (sErr || !signed?.signedUrl) {
      return Response.json({ ok: false, error: { code: "SIGNED_URL_FAILED" } }, { status: 502 });
    }

    // 5. Профиль для брендинга
    const { data: profile } = await supabase.from("profiles").select("*").single();

    // 6. HTML email: header компании + message + таблица квоута + ссылка на PDF
    const selectedVariant = (quote.variants || []).find((v: any) => v.type === quote.selected_variant);
    const html = buildEmailHtml({ company: profile, message, variant: selectedVariant, pdfLink: signed.signedUrl });

    // 7. Отправка через Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${profile?.company_name || "FenceQuoter"} <quotes@fencequoter.app>`,
        to: [to], subject, html,
      }),
    });
    if (!res.ok) return Response.json({ ok: false, error: { code: "EMAIL_FAILED" } }, { status: 502 });

    // 8. Обновить статус
    await supabase.from("quotes")
      .update({ status: "sent", sent_via: "email", sent_at: new Date().toISOString() })
      .eq("id", quote_id);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: { code: "INTERNAL", message: String(err) } }, { status: 500 });
  }
});

function buildEmailHtml(params: { company: any; message: string; variant: any; pdfLink: string }): string {
  // TODO: company header + message + summary table (items, subtotal, markup, tax, total) + PDF button
  // Inline CSS, mobile-friendly, один accent color
  return `<html>...</html>`;
}
```

### 7.2 send-sms — `supabase/functions/send-sms/index.ts`

**Request:**
```json
{ "quote_id": "uuid", "to": "+14155550123", "message": "Hi John, your fence quote is ready" }
```

**Логика:** те же шаги 1-4 (auth, fetch quote, guard, signed URL). Вместо Resend → Twilio SMS.

```typescript
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER")!;

// POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
// Auth: Basic base64(SID:TOKEN)
// Body: To, From, Body (message + "\n\nView quote: " + signedUrl)
```

### Secrets (Supabase Dashboard → Edge Functions)
```
RESEND_API_KEY=re_xxxx
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_PHONE_NUMBER=+1xxxx
```

---

## 8. PDF-шаблон (`lib/pdf.ts`)

HTML-строка, интерполируемая данными квоута.

**Содержимое:**
- Логотип компании (`getPublicUrl` из logos bucket) + company_name + phone + email
- Дата + номер квоута (QTE-001)
- Имя клиента + адрес
- Таблица: Item | Qty | Unit Price | Total (секции Materials, Labor, Custom)
- Subtotal, Markup (X%), Tax (X%), **TOTAL**
- Terms & conditions (из settings.terms_template)
- Футер: "Valid for 30 days"
- Free: watermark "Created with FenceQuoter — fencequoter.app"

**Стиль:** чистый, inline CSS, mobile-friendly, один accent color (синий).

**Flow:**
1. Собрать HTML строку с данными
2. `RNHTMLtoPDF.convert({ html, fileName: quote_id })`
3. Upload → Storage `quote-pdfs/<user_id>/<quote_id>.pdf`
4. Сохранить path (не URL) в `quotes.pdf_url`

---

## 9. Структура проекта

```
FenceQuoter/
├── CLAUDE.md
├── app.config.ts
├── tailwind.config.js
├── eas.json
├── app/
│   ├── _layout.tsx              # root: AuthProvider
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── resetPassword.tsx
│   └── (app)/
│       ├── _layout.tsx          # auth guard
│       ├── onboarding.tsx
│       ├── newQuote.tsx
│       ├── results.tsx
│       ├── pdfPreview.tsx
│       ├── history.tsx
│       ├── settings.tsx
│       └── paywall.tsx
├── components/
│   ├── ui/                      # Button, Input, Card, Badge, Modal, Stepper
│   ├── QuoteForm.tsx
│   ├── VariantCard.tsx
│   ├── QuoteBreakdown.tsx
│   ├── QuoteListItem.tsx
│   ├── PaywallBanner.tsx
│   └── EmptyState.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useSettings.ts
│   ├── useMaterials.ts
│   ├── useQuotes.ts
│   ├── useEntitlements.ts       # RevenueCat
│   ├── useNetworkStatus.ts
│   └── useOfflineQuote.ts       # AsyncStorage draft
├── lib/
│   ├── supabase.ts
│   ├── calculator.ts            # чистые функции
│   ├── pdf.ts                   # HTML template + RNHTMLtoPDF
│   ├── send.ts                  # вызов Edge Functions
│   └── validation.ts            # Zod-схемы
├── types/
│   ├── database.ts
│   └── quote.ts
├── constants/
│   ├── coefficients.ts          # FENCE_SPECS, TERRAIN_MULTIPLIERS
│   ├── defaults.ts              # REGIONAL_DEFAULTS
│   └── theme.ts
├── __tests__/
│   ├── calculator.test.ts
│   └── validation.test.ts
├── assets/
│   ├── icon.png                 # 1024x1024
│   ├── splash.png
│   ├── adaptive-icon.png
│   └── favicon.png
└── supabase/
    ├── migrations/
    │   └── 001_initial.sql
    └── functions/
        ├── send-email/
        │   └── index.ts
        └── send-sms/
            └── index.ts
```

---

## 10. App Store / Google Play

### Ассеты
- `icon.png` — 1024×1024, без альфа, без скруглений
- `adaptive-icon.png` — 1024×1024 (Android safe zone)
- `splash.png` — 1284×2778
- Скриншоты iOS: 6.7" (1290×2796), 6.5" (1284×2778), 5.5" (1242×2208)
- Скриншоты Android: Phone 16:9

### Обязательно
- Privacy Policy URL
- Terms of Service URL
- Тестовый аккаунт: demo@fencequoter.app / TestPassword123
- Кнопка "Restore Purchases"
- Data Safety (Google Play)
- Content Rating (Google Play)
- Описание подписки: содержимое, цена, период, как отменить

### app.config.ts
```typescript
{
  name: "FenceQuoter",
  slug: "fencequoter",
  version: "1.0.0",
  scheme: "fencequoter",
  ios: { bundleIdentifier: "app.fencequoter", supportsTablet: true },
  android: {
    package: "app.fencequoter",
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#1a73e8" },
  },
}
```

---

## 11. Порядок реализации

### Правило: "Plan → Execute"
1. Перечислить файлы для создания/изменения
2. Описать что именно меняем
3. Получить подтверждение
4. Писать код
5. Тесты, проверка что ничего не сломано

### Фазы

```
Phase 1 — Foundation
  [ ] create-expo-app + NativeWind + Supabase client
  [ ] Types (database.ts, quote.ts)
  [ ] Constants (coefficients.ts, defaults.ts)
  [ ] Migration 001_initial.sql → Supabase

Phase 2 — Auth + Onboarding
  [ ] Auth screens (login, register, resetPassword)
  [ ] useAuth hook + auth guard в (app)/_layout
  [ ] Onboarding screen
  [ ] useProfile, useSettings hooks
  [ ] seed_materials_for_user() после onboarding

Phase 3 — Quote Flow (ядро)
  [ ] lib/calculator.ts + тесты
  [ ] lib/validation.ts + тесты
  [ ] newQuote screen + QuoteForm
  [ ] useOfflineQuote (AsyncStorage)
  [ ] results screen + VariantCard + QuoteBreakdown
  [ ] useQuotes hook

Phase 4 — PDF + Sending
  [ ] lib/pdf.ts (HTML template)
  [ ] pdfPreview screen
  [ ] Upload PDF → Storage, save path
  [ ] Edge Function: send-email
  [ ] Edge Function: send-sms
  [ ] lib/send.ts

Phase 5 — History + Settings
  [ ] history screen + QuoteListItem
  [ ] settings screen
  [ ] useMaterials hook

Phase 6 — Paywall
  [ ] RevenueCat setup
  [ ] useEntitlements hook
  [ ] paywall screen + sent_quotes_this_month check
  [ ] Restore purchases
  [ ] Watermark in pdf.ts

Phase 7 — Polish + Ship
  [ ] App icon + splash
  [ ] Empty states, error handling
  [ ] eas.json + production builds
  [ ] App Store + Google Play submit
  [ ] Web export + Vercel
```

---

## 12. Текущий статус

**Последнее обновление:** 2026-02-16
**Текущая фаза:** Phase 7 — ЗАВЕРШЕНА ✅

### Что сделано:

**Phase 1 — Foundation** ✅
- [x] create-expo-app + NativeWind + Supabase client
- [x] Types (database.ts, quote.ts)
- [x] Constants (coefficients.ts, defaults.ts)
- [x] lib/calculator.ts + 110 unit-тестов
- [x] lib/validation.ts (Zod-схемы)
- [x] hooks: useAuth, useProfile, useSettings, useMaterials, useOfflineQuote

**Phase 2 — Auth + Onboarding** ✅
- [x] Auth screens (login, register, resetPassword)
- [x] AuthContext + useAuth hook
- [x] Auth guard в (app)/_layout.tsx
- [x] Onboarding screen

**Phase 3 — Quote Flow** ✅
- [x] newQuote screen + QuoteForm component
- [x] results screen + VariantCard + QuoteBreakdown
- [x] useOfflineQuote (автосохранение в AsyncStorage)
- [x] Интеграция calculateQuote + валидация
- [x] useQuotes hook (полный CRUD: create, read, update, delete, duplicate)
- [x] Сохранение quote в Supabase перед переходом на pdfPreview

**Phase 4 — PDF + Sending** ✅
- [x] lib/pdf.ts (HTML template с watermark для free)
- [x] lib/storage.ts (upload PDF to Supabase Storage)
- [x] lib/send.ts (вызов Edge Functions для email/SMS)
- [x] pdfPreview screen (генерация, upload, send email/SMS, share)
- [x] Supabase Edge Functions: send-email, send-sms
- [x] Paywall check перед отправкой

**Phase 5 — History + Settings** ✅
- [x] history screen (фильтры Active/Sent/Closed, pull-to-refresh, FAB)
- [x] QuoteListItem component (swipe-to-delete, status badges)
- [x] EmptyState component
- [x] settings screen (useProfile + useSettings интеграция)
- [x] Сохранение настроек в Supabase

**Phase 6 — Paywall** ✅
- [x] useEntitlements hook (RevenueCat интеграция)
- [x] paywall screen (purchase, restore, return flow)
- [x] pdfPreview: динамическая проверка isPro через useEntitlements
- [x] pdfPreview: initial paywall check (sent_quotes_this_month >= 3)
- [x] Watermark только для free-юзеров

**Phase 7 — Polish + Ship** ✅
- [x] app.json: bundleIdentifier (iOS), package (Android), permissions
- [x] eas.json: development, preview, production build profiles
- [x] OfflineBanner component (animated slide-in при потере сети)
- [x] Empty states унифицированы через EmptyState компонент
- [x] Error handling sweep (useAuth, useQuotes, useEntitlements)
- [x] UI/UX аудит: max-width 480px, стандартизация высот/шрифтов
- [x] PDF template: formatPhone(), logo support, improved Total styling
- [x] QuoteBreakdown: zebra striping, dotted leaders, bold prices
- [x] Web workarounds: window.print() для PDF, mailto: для email

### Что осталось (требует ручной работы):
- [ ] Заменить `your-project-id` в app.json на EAS project ID (`eas init`)
- [ ] Заменить Apple/Google credentials в eas.json
- [ ] Создать брендированные app icons (текущие — placeholder)
- [ ] `eas build --profile production --platform all`
- [ ] App Store / Google Play submission

### Блокеры:
- нет (код готов, нужны только credentials и assets)

### Git commits (последние):
```
c4197c0 phase 7: polish and production prep
0cd116e ui: simplify history tabs to Active/Sent/Closed
821ba6f fix: Draft tab shows both draft and calculated quotes
bbb2224 pdf: improve template formatting
5b99b9b ui: improve QuoteBreakdown readability
20a2bd0 ui/ux: comprehensive style audit + web PDF/email workarounds
c2341bf phase 5: history with filters and swipe-delete, settings screen
116e436 phase 3-4: quote flow complete, calculator, forms, results, pdf, sending
```

---

*MVP code complete. Ready for production builds and store submission.*