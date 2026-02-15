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
- Форма квоута работает офлайн: данные сохраняются в AsyncStorage
- При появлении сети — синхронизация с Supabase
- Индикатор статуса сети в header (необязательно для MVP, но подготовить хук `useNetworkStatus`)

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

Paywall check: перед /(app)/pdfPreview
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
- Deep link для email verification
- "Forgot password" flow
- Минимум полей: email, password. Остальное — в onboarding.

### 4.2 Onboarding — `(app)/onboarding.tsx`
- company_name (required)
- phone (required)
- logo (optional, камера или галерея → Supabase Storage `logos/`)
- region picker: US / UK / CA / AU / EU / Other
- currency (автоматически по региону, но можно сменить)
- unit_system: imperial (ft, in) / metric (m, cm) — автоматически по региону
- hourly_rate (required, default по региону — см. секцию 9)
- default_markup_percent (default: 20%)
- tax_percent (default: 0%, подсказка "Sales tax if applicable")
- Кнопка "Start Quoting →"
- При сохранении: создать profile + settings + seed materials из defaults

### 4.3 New Quote — `(app)/newQuote.tsx`
**Клиентская секция:**
- client_name (required)
- client_phone (optional)
- client_email (optional)
- address (optional, text)

**Параметры забора:**
- fence_type: picker из `['wood_privacy', 'wood_picket', 'chain_link', 'vinyl', 'aluminum']`
- length: number (ft или m, зависит от unit_system)
- height: picker из стандартных для типа (например wood: 4ft, 5ft, 6ft, 8ft)
- gates_standard: number (default 0, stepper +/-)
- gates_large: number (default 0, stepper +/-, "double/driveway gate")
- remove_old: toggle (default false)
- terrain: picker `['flat', 'slight_slope', 'steep_slope', 'rocky']`
- notes: textarea (optional)
- photos: до 5 фото (камера/галерея → Supabase Storage `quote-photos/`)

**UX:**
- Автосохранение в AsyncStorage каждые 5 секунд (офлайн-safe)
- Кнопка "Calculate →" внизу
- Валидация перед переходом (length > 0, fence_type selected)

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
- **PAYWALL CHECK при входе на экран**
- Генерация PDF из HTML-шаблона (react-native-html-to-pdf)
- Шаблон включает: логотип компании, контакты, клиент, разбивка, условия, дата
- Free-версия: watermark "Created with FenceQuoter"
- Кнопки: "Send Email", "Send SMS", "Share" (native share sheet), "Download"
- Upload PDF в Supabase Storage `quote-pdfs/`

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
- **Pricing:** hourly_rate, default_markup, tax_percent
- **Materials:** список материалов с ценами (tap → edit price)
- **Terms:** textarea с шаблоном условий для PDF
- **Subscription:** текущий план, manage/upgrade, restore purchases
- **Account:** email, change password, logout, delete account
- **About:** version, support email, privacy policy, terms of service

### 4.8 Paywall — `(app)/paywall.tsx`
- Показывает когда free-лимит исчерпан (3 отправленных квоутов/мес)
- Лимит считается по: quotes WHERE status = 'sent' AND created_at в текущем месяце
- Показать: "You've sent 3/3 free quotes this month"
- Преимущества Pro: unlimited quotes, no watermark, SMS sending, priority support
- Кнопки: "$49/month" и "$39/month (billed yearly)"
- Кнопка "Restore Purchases" (ОБЯЗАТЕЛЬНА для Apple)
- RevenueCat: offerings → purchase → verify entitlement → redirect back

---

## 5. База данных (Supabase)

### Таблицы

```sql
-- Профиль пользователя / компании
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null,
  phone text,
  email text,
  logo_url text,
  region text not null default 'US',
  currency text not null default 'USD',
  unit_system text not null default 'imperial',
  created_at timestamptz not null default now()
);

-- Настройки расчёта
create table settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  hourly_rate numeric not null default 45,
  default_markup_percent numeric not null default 20,
  tax_percent numeric not null default 0,
  terms_template text default '',
  unique(user_id)
);

-- Каталог материалов (у каждого юзера свой, seed при onboarding)
create table materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  fence_type text not null,
  name text not null,
  unit text not null,
  unit_price numeric not null,
  category text not null, -- 'post', 'rail', 'panel', 'concrete', 'hardware', 'gate'
  sort_order int default 0
);

-- Квоуты (основная таблица, variants хранятся в JSONB)
create table quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  client_name text not null,
  client_phone text,
  client_email text,
  client_address text,
  status text not null default 'draft',
  -- check (status in ('draft','calculated','sent','accepted','rejected'))
  
  -- Входные параметры (то что юзер ввёл в форму)
  inputs jsonb not null,
  -- { fence_type, length, height, gates_standard, gates_large,
  --   remove_old, terrain, notes }
  
  -- Рассчитанные варианты (3 объекта)
  variants jsonb,
  -- [ { type: 'budget', markup_percent, items: [...], subtotal, markup, tax, total },
  --   { type: 'standard', ... },
  --   { type: 'premium', ... } ]
  
  selected_variant text, -- 'budget' | 'standard' | 'premium'
  custom_items jsonb default '[]',
  -- [ { name, qty, unit_price, total } ]
  
  pdf_url text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Фото к квоуту
create table quote_photos (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);
```

### RLS (включить на ВСЕХ таблицах)

```sql
-- profiles
alter table profiles enable row level security;
create policy "Users see own profile" on profiles
  for all using (id = auth.uid());

-- settings
alter table settings enable row level security;
create policy "Users see own settings" on settings
  for all using (user_id = auth.uid());

-- materials
alter table materials enable row level security;
create policy "Users see own materials" on materials
  for all using (user_id = auth.uid());

-- quotes
alter table quotes enable row level security;
create policy "Users see own quotes" on quotes
  for all using (user_id = auth.uid());

-- quote_photos
alter table quote_photos enable row level security;
create policy "Users see own photos" on quote_photos
  for all using (
    quote_id in (select id from quotes where user_id = auth.uid())
  );
```

### Storage buckets
- `logos` — public read, auth write
- `quote-photos` — auth read/write, scoped by user
- `quote-pdfs` — auth read/write, scoped by user

### Edge Functions
- `send-email` — принимает { to, subject, html, pdf_url }, вызывает Resend API
- `send-sms` — принимает { to, body }, вызывает Twilio API

---

## 6. Расчёт — `lib/calculator.ts`

### Интерфейсы

```typescript
interface QuoteInputs {
  fence_type: FenceType;
  length: number;       // в единицах unit_system
  height: number;       // в единицах unit_system
  gates_standard: number;
  gates_large: number;
  remove_old: boolean;
  terrain: TerrainType;
}

type FenceType = 'wood_privacy' | 'wood_picket' | 'chain_link' | 'vinyl' | 'aluminum';
type TerrainType = 'flat' | 'slight_slope' | 'steep_slope' | 'rocky';
type VariantType = 'budget' | 'standard' | 'premium';

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
  subtotal: number;
  markup_amount: number;
  tax_amount: number;
  total: number;
}

interface CalculatorResult {
  variants: QuoteVariant[];
}
```

### Коэффициенты — `constants/coefficients.ts`

```typescript
export const FENCE_SPECS: Record<FenceType, FenceSpec> = {
  wood_privacy: {
    label: 'Wood Privacy',
    post_spacing: 8,        // ft between posts
    rails_per_section: 3,   // horizontal rails per section
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
    rails_per_section: 1,    // top rail
    concrete_bags_per_post: 0.75,
    labor_hours_per_ft: 0.08,
    available_heights: [4, 5, 6],
    default_height: 4,
  },
  vinyl: {
    label: 'Vinyl',
    post_spacing: 8,
    rails_per_section: 0,    // panels are self-contained
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
  standard: 1.5,  // hours per standard gate
  large: 3.0,     // hours per large/driveway gate
};

export const REMOVAL_HOURS_PER_FT = 0.05;

export const VARIANT_MARKUP_MODIFIERS: Record<VariantType, number> = {
  budget: -5,      // subtract 5% from default markup
  standard: 0,     // use default markup as-is
  premium: +10,    // add 10% to default markup
};
```

### Seed-данные материалов — `constants/defaults.ts`

```typescript
// Цены в USD, для других регионов — коэффициент конвертации при onboarding
export const DEFAULT_MATERIALS: MaterialSeed[] = [
  // WOOD PRIVACY
  { fence_type: 'wood_privacy', name: '4x4 Pressure-treated post (8ft)', unit: 'each', unit_price: 14.00, category: 'post' },
  { fence_type: 'wood_privacy', name: '2x4 Rail (8ft)', unit: 'each', unit_price: 5.50, category: 'rail' },
  { fence_type: 'wood_privacy', name: 'Privacy fence pickets (6ft, dog-ear)', unit: 'each', unit_price: 3.25, category: 'panel' },
  { fence_type: 'wood_privacy', name: 'Concrete mix (50lb bag)', unit: 'bag', unit_price: 5.50, category: 'concrete' },
  { fence_type: 'wood_privacy', name: 'Post caps, screws, brackets (per section)', unit: 'set', unit_price: 8.00, category: 'hardware' },
  { fence_type: 'wood_privacy', name: 'Standard walk gate (wood)', unit: 'each', unit_price: 85.00, category: 'gate' },
  { fence_type: 'wood_privacy', name: 'Double driveway gate (wood)', unit: 'each', unit_price: 250.00, category: 'gate' },

  // CHAIN LINK
  { fence_type: 'chain_link', name: 'Terminal post (galvanized)', unit: 'each', unit_price: 18.00, category: 'post' },
  { fence_type: 'chain_link', name: 'Line post (galvanized)', unit: 'each', unit_price: 11.00, category: 'post' },
  { fence_type: 'chain_link', name: 'Top rail (10.5ft)', unit: 'each', unit_price: 9.50, category: 'rail' },
  { fence_type: 'chain_link', name: 'Chain link fabric (per linear ft)', unit: 'ft', unit_price: 3.75, category: 'panel' },
  { fence_type: 'chain_link', name: 'Concrete mix (50lb bag)', unit: 'bag', unit_price: 5.50, category: 'concrete' },
  { fence_type: 'chain_link', name: 'Ties, tension bars, bands (per section)', unit: 'set', unit_price: 6.00, category: 'hardware' },
  { fence_type: 'chain_link', name: 'Walk gate (chain link, 4ft)', unit: 'each', unit_price: 95.00, category: 'gate' },
  { fence_type: 'chain_link', name: 'Double driveway gate (chain link)', unit: 'each', unit_price: 275.00, category: 'gate' },

  // VINYL
  { fence_type: 'vinyl', name: 'Vinyl post (5x5, with cap)', unit: 'each', unit_price: 28.00, category: 'post' },
  { fence_type: 'vinyl', name: 'Vinyl panel (6ft x 8ft)', unit: 'each', unit_price: 65.00, category: 'panel' },
  { fence_type: 'vinyl', name: 'Concrete mix (50lb bag)', unit: 'bag', unit_price: 5.50, category: 'concrete' },
  { fence_type: 'vinyl', name: 'Brackets, screws kit (per section)', unit: 'set', unit_price: 5.00, category: 'hardware' },
  { fence_type: 'vinyl', name: 'Standard vinyl gate', unit: 'each', unit_price: 150.00, category: 'gate' },
  { fence_type: 'vinyl', name: 'Double vinyl driveway gate', unit: 'each', unit_price: 400.00, category: 'gate' },

  // ALUMINUM
  { fence_type: 'aluminum', name: 'Aluminum post (2x2)', unit: 'each', unit_price: 22.00, category: 'post' },
  { fence_type: 'aluminum', name: 'Aluminum panel (6ft section)', unit: 'each', unit_price: 55.00, category: 'panel' },
  { fence_type: 'aluminum', name: 'Concrete mix (50lb bag)', unit: 'bag', unit_price: 5.50, category: 'concrete' },
  { fence_type: 'aluminum', name: 'Post caps, mounting hardware (per section)', unit: 'set', unit_price: 6.00, category: 'hardware' },
  { fence_type: 'aluminum', name: 'Aluminum walk gate', unit: 'each', unit_price: 175.00, category: 'gate' },
  { fence_type: 'aluminum', name: 'Double aluminum driveway gate', unit: 'each', unit_price: 450.00, category: 'gate' },

  // WOOD PICKET
  { fence_type: 'wood_picket', name: '4x4 Post (6ft)', unit: 'each', unit_price: 10.00, category: 'post' },
  { fence_type: 'wood_picket', name: '2x4 Rail (8ft)', unit: 'each', unit_price: 5.50, category: 'rail' },
  { fence_type: 'wood_picket', name: 'Picket (42in, pointed)', unit: 'each', unit_price: 2.00, category: 'panel' },
  { fence_type: 'wood_picket', name: 'Concrete mix (50lb bag)', unit: 'bag', unit_price: 5.50, category: 'concrete' },
  { fence_type: 'wood_picket', name: 'Screws, post caps (per section)', unit: 'set', unit_price: 6.00, category: 'hardware' },
  { fence_type: 'wood_picket', name: 'Walk gate (picket)', unit: 'each', unit_price: 70.00, category: 'gate' },
  { fence_type: 'wood_picket', name: 'Double gate (picket)', unit: 'each', unit_price: 180.00, category: 'gate' },
];

// Количество пикетов на фут для wood-типов
export const PICKETS_PER_FOOT = {
  wood_privacy: 2.4,   // tight spacing, ~5 inch picket
  wood_picket: 1.8,    // wider spacing
};

// Дефолтные ставки по регионам (USD-equivalent)
export const REGIONAL_DEFAULTS: Record<string, RegionalDefault> = {
  US: { currency: 'USD', unit_system: 'imperial', hourly_rate: 45, symbol: '$' },
  CA: { currency: 'CAD', unit_system: 'imperial', hourly_rate: 50, symbol: 'C$' },
  UK: { currency: 'GBP', unit_system: 'metric', hourly_rate: 35, symbol: '£' },
  AU: { currency: 'AUD', unit_system: 'metric', hourly_rate: 55, symbol: 'A$' },
  EU: { currency: 'EUR', unit_system: 'metric', hourly_rate: 40, symbol: '€' },
  Other: { currency: 'USD', unit_system: 'metric', hourly_rate: 30, symbol: '$' },
};
```

### Формула расчёта (алгоритм)

```
1. Получить FenceSpec по fence_type
2. posts = ceil(length / post_spacing) + 1
3. sections = posts - 1
4. Материалы (зависят от типа):
   - posts: posts * post_price
   - rails: sections * rails_per_section * rail_price
   - panels/pickets:
     - если panel-based (vinyl, aluminum): sections * panel_price
     - если picket-based (wood): length * pickets_per_foot * picket_price
   - concrete: posts * concrete_bags_per_post * concrete_price
   - hardware: sections * hardware_price
   - gates: standard_gates * gate_price + large_gates * large_gate_price
5. Работа:
   - base_hours = length * labor_hours_per_ft
   - gate_hours = standard_gates * GATE_LABOR_HOURS.standard 
                + large_gates * GATE_LABOR_HOURS.large
   - removal_hours = remove_old ? length * REMOVAL_HOURS_PER_FT : 0
   - total_hours = (base_hours + gate_hours + removal_hours) * terrain_multiplier
   - labor_cost = total_hours * hourly_rate
6. subtotal = materials_total + labor_cost
7. Для каждого варианта:
   - effective_markup = max(0, default_markup + variant_modifier)
   - markup_amount = subtotal * (effective_markup / 100)
   - tax_amount = (subtotal + markup_amount) * (tax_percent / 100)
   - total = subtotal + markup_amount + tax_amount
```

**Функция должна быть чистой:** принимает inputs + materials + settings → возвращает `CalculatorResult`. Никаких side effects, никаких сетевых вызовов.

---

## 7. Структура проекта

```
FenceQuoter/
├── CLAUDE.md                    # этот файл
├── app.config.ts                # Expo config
├── tailwind.config.js           # NativeWind
├── app/
│   ├── _layout.tsx              # root layout (AuthProvider, ThemeProvider)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── resetPassword.tsx
│   └── (app)/
│       ├── _layout.tsx          # tabs или stack, auth guard
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
│   ├── calculator.ts            # чистые функции расчёта
│   ├── pdf.ts                   # HTML-шаблон + генерация
│   ├── send.ts                  # вызов Edge Functions
│   └── validation.ts            # Zod-схемы
├── types/
│   ├── database.ts              # generated from Supabase or manual
│   └── quote.ts                 # QuoteInputs, QuoteVariant, etc.
├── constants/
│   ├── coefficients.ts          # FENCE_SPECS, TERRAIN_MULTIPLIERS, etc.
│   ├── defaults.ts              # DEFAULT_MATERIALS, REGIONAL_DEFAULTS
│   └── theme.ts                 # цвета, если нужны за пределами Tailwind
├── __tests__/
│   ├── calculator.test.ts
│   └── validation.test.ts
├── assets/
│   ├── icon.png                 # 1024x1024 app icon
│   ├── splash.png               # splash screen
│   ├── adaptive-icon.png        # Android adaptive
│   └── favicon.png              # web
└── supabase/
    ├── migrations/
    │   └── 001_initial.sql      # таблицы + RLS из секции 5
    └── functions/
        ├── send-email/
        │   └── index.ts
        └── send-sms/
            └── index.ts
```

---

## 8. PDF-шаблон (`lib/pdf.ts`)

HTML-строка, интерполируемая данными квоута. Минимальный брендинг.

Содержимое:
- Логотип компании (если есть) + company_name + phone + email
- Дата + номер квоута (QTE-001, автоинкремент)
- Имя клиента + адрес
- Таблица: Item | Qty | Unit Price | Total
  - Секция Materials
  - Секция Labor
  - Custom items (если есть)
- Subtotal, Markup, Tax, **TOTAL** (жирный)
- Terms & conditions (из settings)
- Футер: "Valid for 30 days"
- Free-версия: watermark "Created with FenceQuoter — fencequoter.app"

**Стиль:** чистый, профессиональный, чёрно-белый с одним accent color. Не перегружать дизайном.

---

## 9. App Store / Google Play — требования

### Обязательные ассеты
- `icon.png` — 1024×1024, без альфа-канала, без скруглений (Apple скруглит сам)
- `adaptive-icon.png` — 1024×1024 (Android, с safe zone)
- `splash.png` — 1284×2778 (или responsive через expo-splash-screen)
- Скриншоты для App Store: 6.7" (1290×2796), 6.5" (1284×2778), 5.5" (1242×2208)
- Скриншоты для Google Play: Phone (16:9 или 9:16), 7" tablet (необязательно)

### Обязательные для review
- Privacy Policy URL (захостить на Vercel, сгенерить через ChatGPT)
- Terms of Service URL
- Тестовый аккаунт для Apple reviewer: demo@fencequoter.app / TestPassword123
- Кнопка "Restore Purchases" (Apple отклонит без неё)
- Data Safety форма (Google Play)
- Content Rating (Google Play)
- Описание подписки: что входит, цена, период, отмена

### app.config.ts минимум
```typescript
{
  name: "FenceQuoter",
  slug: "fencequoter",
  version: "1.0.0",
  scheme: "fencequoter",       // для deep linking
  ios: {
    bundleIdentifier: "app.fencequoter",
    supportsTablet: true,
  },
  android: {
    package: "app.fencequoter",
    adaptiveIcon: { ... },
  },
  plugins: [
    "expo-router",
    // + RevenueCat plugin если нужен
  ],
}
```

---

## 10. Порядок реализации (для агента)

### Правило: "Plan → Execute"
1. Перечислить файлы, которые будут созданы/изменены
2. Описать что именно меняем в каждом файле
3. Получить подтверждение
4. Только после этого писать код
5. После кода — запустить тесты (если есть) и проверить что ничего не сломано

### Этапы (в порядке реализации)

```
Phase 1 — Foundation
  [x] Repo initialized (create-expo-app)
  [ ] CLAUDE.md добавлен
  [ ] NativeWind настроен
  [ ] Supabase клиент (lib/supabase.ts)
  [ ] Types (types/database.ts, types/quote.ts)
  [ ] Constants (coefficients.ts, defaults.ts)
  [ ] Миграция БД (supabase/migrations/001_initial.sql)

Phase 2 — Auth + Onboarding
  [ ] Auth screens (login, register, resetPassword)
  [ ] useAuth hook
  [ ] Auth guard в (app)/_layout.tsx
  [ ] Onboarding screen
  [ ] useProfile + useSettings hooks
  [ ] Seed materials при первом onboarding

Phase 3 — Quote Flow (ядро продукта)
  [ ] lib/calculator.ts + тесты
  [ ] lib/validation.ts (Zod) + тесты
  [ ] newQuote screen + QuoteForm component
  [ ] useOfflineQuote (AsyncStorage draft)
  [ ] results screen + VariantCard + QuoteBreakdown
  [ ] useQuotes hook (CRUD)

Phase 4 — PDF + Sending
  [ ] lib/pdf.ts (HTML template)
  [ ] pdfPreview screen
  [ ] Supabase Edge Function: send-email
  [ ] Supabase Edge Function: send-sms
  [ ] lib/send.ts
  [ ] Upload PDF to Storage

Phase 5 — History + Settings
  [ ] history screen + QuoteListItem
  [ ] settings screen
  [ ] useMaterials hook (edit prices)

Phase 6 — Paywall
  [ ] RevenueCat setup
  [ ] useEntitlements hook
  [ ] paywall screen
  [ ] Paywall check в pdfPreview
  [ ] Restore purchases
  [ ] Watermark logic в pdf.ts

Phase 7 — Polish + Ship
  [ ] App icon + splash screen
  [ ] Empty states
  [ ] Error handling sweep
  [ ] Offline indicator
  [ ] EAS Build config (eas.json)
  [ ] Production builds (iOS + Android)
  [ ] Web export + Vercel deploy
  [ ] App Store submission
  [ ] Google Play submission
```

---

## 11. Текущий статус

**Последнее обновление:** [дата]
**Текущая фаза:** Phase 1 — Foundation
**Что сделано:**
- [ ] ...

**Что делаем сейчас:**
- [ ] ...

**Блокеры:**
- нет

---

*Обновлять секцию 11 после каждой сессии с Claude Code.*
