# AI Quote Calculator для подрядчиков
## Полная стратегия создания: от нуля до App Store за 5 недель

---

## ЧАСТЬ 1: ПРОДУКТ

### Что строим

Мобильное приложение (iOS + Android) + веб-версия. Подрядчик по установке заборов (первый trade) вводит параметры объекта → система рассчитывает стоимость материалов и работы → показывает 3 варианта (Budget / Standard / Premium) → генерирует брендированный PDF → отправляет клиенту по email/SMS прямо с объекта.

### Почему заборы — первый trade

Параметры конечны: длина, высота, тип материала (дерево/металл/винил), ворота, рельеф. Самый простой калькулятор из всех trades. 180,000+ fence contractors только в США. Facebook-группа "Fence Contractors" — 47K участников. После валидации → клонируем на покраску, плитку, кровлю.

### Полный flow MVP

```
Register → Onboarding (company + settings + seed materials)
  → New Quote (форма + офлайн-сохранение)
    → Results (3 варианта: Budget/Standard/Premium)
      → PDF Preview (генерация + upload)
        → Send (email/SMS через Edge Functions, signed URL 30 дней)
          → History (список + фильтр по статусу)

Paywall: блокирует отправку после 3 sent квоутов/мес (расчёт бесплатный)
```

---

## ЧАСТЬ 2: ТЕХНИЧЕСКИЙ СТЕК

### Стек

| Слой | Технология | Почему |
|---|---|---|
| **Frontend** | Expo SDK 52+ (React Native) | Один код → iOS + Android + Web. EAS Build |
| **UI** | NativeWind v4 (Tailwind для RN) | Claude Code хорошо знает Tailwind |
| **Навигация** | Expo Router (file-based) | Файлы = маршруты, проще для AI |
| **Backend** | Supabase | Postgres + Auth + Storage + Edge Functions + RLS |
| **Auth** | Supabase Auth | Email/password + Google + Apple |
| **Платежи** | RevenueCat | App Store/Play подписки, бесплатно до $2.5K MRR |
| **PDF** | react-native-html-to-pdf | Генерация на устройстве |
| **Email** | Resend | Через Supabase Edge Function |
| **SMS** | Twilio | Через Supabase Edge Function |
| **Storage** | Supabase Storage | Logos (public), photos + PDFs (private, signed URLs) |
| **Аналитика** | PostHog | Retention tracking |

### Стоимость на старте

| Сервис | Стоимость |
|---|---|
| Supabase Free | $0/мес |
| Expo EAS Free | $0 (30 билдов/мес) |
| RevenueCat | $0 до $2.5K MRR |
| Apple Developer | $99/год |
| Google Play Developer | $25 единоразово |
| Resend Free | $0 (100 emails/день) |
| Vercel Free | $0 (веб-версия) |
| **Итого** | **~$125 единоразово, $0/мес** |

---

## ЧАСТЬ 3: АРХИТЕКТУРА BACKEND

### База данных (5 таблиц)

```
profiles     — компания, логотип, регион, валюта (1:1 с auth.users)
settings     — ставка/час, наценка %, налог %, шаблон условий (1:1)
materials    — каталог материалов по fence_type (35 seed-позиций по 5 типам)
quotes       — квоуты с variants в JSONB (не отдельные таблицы!)
quote_photos — фото объектов
```

**Ключевое решение: variants как JSONB, не отдельные таблицы.**
Один запрос `select * from quotes where id = X` — и все данные на месте. Для MVP это экономит 2-3 дня разработки. Нормализовать можно позже.

**Markup хранится как целое число.** 20 = двадцать процентов. В калькуляторе: `subtotal * (markup / 100)`. Никакой путаницы.

### Storage (3 bucket-а)

| Bucket | Public | Path | Назначение |
|---|---|---|---|
| `logos` | Да (read) | `<user_id>/logo.png` | Логотип в PDF |
| `quote-photos` | Нет | `<user_id>/<quote_id>/<uuid>.jpg` | Фото объекта |
| `quote-pdfs` | Нет | `<user_id>/<quote_id>.pdf` | Сгенерированные PDF |

**Важно:** В `quotes.pdf_url` хранится **path**, не URL. Для отправки клиенту → Edge Function генерирует signed URL на 30 дней. Клиент получает рабочую ссылку без логина.

### Edge Functions

**send-email:** принимает `quote_id` + `to` + `subject` + `message` → проверяет владельца → guard от повторной отправки → signed URL → HTML email с таблицей квоута + ссылка на PDF → обновляет статус на `sent`.

**send-sms:** аналогично, но через Twilio. SMS с текстом + ссылка на PDF.

### RLS + Security
- Все 5 таблиц под RLS: `user_id = auth.uid()`
- Storage: write/read только в папке `auth.uid()/`
- Edge Functions: auth header → RLS проверяет ownership
- Signed URLs на 30 дней (для клиентов подрядчика)

---

## ЧАСТЬ 4: WORKFLOW — ChatGPT + Claude Code

### Разделение ролей

```
ChatGPT → планирование, PRD, спецификации, тексты для App Store
Claude Code → весь код, отладка, тесты, билды
CLAUDE.md → "конституция" проекта, Claude Code читает автоматически
```

### Правила работы с Claude Code

**1. CLAUDE.md в корне проекта** — Claude Code читает его при каждом запуске. Содержит: стек, правила, структуру, схему БД, алгоритмы, фазы. Обновлять секцию "Текущий статус" после каждой сессии.

**2. "Plan → Execute" на каждом шаге:**
```
Шаг 1: "Спланируй какие файлы нужно создать/изменить для [фича]. Не пиши код."
Шаг 2: [ревью плана]
Шаг 3: "Реализуй. Начни с [файл]."
```

**3. Один экран за раз.** Никогда не просить "сделай всё приложение".

**4. Перезапуск каждые 30-40 минут.** Контекст деградирует. CLAUDE.md восстановит.

**5. Тесты как якорь:**
```
"Напиши тест для calculator.ts. Запусти. Если падает — почини код, не тест."
```

---

## ЧАСТЬ 5: ПОШАГОВЫЙ ПЛАН РЕАЛИЗАЦИИ

### Phase 0 — Подготовка (1 день)

```bash
# Установка
npm install -g eas-cli

# Аккаунты
→ Supabase (supabase.com) — создать проект
→ Expo (expo.dev) — зарегистрироваться
→ RevenueCat (revenuecat.com)
→ Apple Developer ($99/год, ждёт 24-48ч)
→ Google Play Console ($25)
→ Resend (resend.com) — API key
```

Положить `CLAUDE.md` и `001_initial.sql` в проект.
Запустить SQL в Supabase SQL Editor.

### Phase 1 — Foundation (2 дня)

Промпт Claude Code:
```
Прочитай CLAUDE.md. Начинаем Phase 1.
Создай проект Expo, настрой NativeWind, Supabase client.
Создай types (database.ts, quote.ts) и constants (coefficients.ts, defaults.ts).
Не пиши экраны — только каркас.
```

Результат: проект запускается, типы и константы на месте.

### Phase 2 — Auth + Onboarding (3 дня)

```
День 1: Auth screens (login, register, resetPassword) + useAuth hook
День 2: Auth guard в (app)/_layout + routing
День 3: Onboarding screen + useProfile + useSettings + seed materials
```

Промпт для onboarding:
```
Создай onboarding screen по CLAUDE.md секция 4.2.
При сохранении: update profile, update settings, вызвать 
supabase.rpc('seed_materials_for_user').
Региональные дефолты из constants/defaults.ts.
```

### Phase 3 — Quote Flow (5 дней) — ЯДРО

```
День 1: lib/calculator.ts + тесты (__tests__/calculator.test.ts)
День 2: lib/validation.ts + тесты
День 3: newQuote screen + QuoteForm + useOfflineQuote
День 4: results screen + VariantCard + QuoteBreakdown
День 5: useQuotes hook + сохранение в Supabase
```

**Критично:** calculator.ts — чистая функция. Вход: inputs + materials + settings → выход: 3 варианта. Тесты для всех 5 типов заборов. Claude Code должен запустить тесты и показать что все проходят.

### Phase 4 — PDF + Sending (3 дня)

```
День 1: lib/pdf.ts (HTML шаблон) + pdfPreview screen + upload в Storage
День 2: Edge Function send-email + lib/send.ts
День 3: Edge Function send-sms + тестирование полного flow
```

Промпт для pdf.ts:
```
Создай lib/pdf.ts по CLAUDE.md секция 8.
HTML шаблон с inline CSS. Логотип через getPublicUrl из bucket logos.
Upload PDF в Storage: quote-pdfs/<user_id>/<quote_id>.pdf
Сохранить PATH (не URL) в quotes.pdf_url.
```

### Phase 5 — History + Settings (2 дня)

```
День 1: history screen + QuoteListItem + фильтры + пустое состояние
День 2: settings screen + useMaterials (редактирование цен)
```

### Phase 6 — Paywall (2 дня)

```
День 1: RevenueCat setup + useEntitlements + paywall screen
День 2: Paywall check в pdfPreview + restore purchases + watermark
```

Промпт для paywall check:
```
В pdfPreview при монтировании:
const { data: count } = await supabase.rpc('sent_quotes_this_month')
Если count >= 3 и нет Pro entitlement → navigate to paywall.
```

### Phase 7 — Polish + Ship (3 дня)

```
День 1: App icon, splash screen, empty states, error handling
День 2: eas.json + production builds (iOS + Android)
День 3: Submit App Store + Google Play + web deploy на Vercel
```

```bash
# Production builds
eas build --profile production --platform ios
eas build --profile production --platform android

# Submit
eas submit --platform ios
eas submit --platform android

# Web
npx expo export --platform web
vercel --prod
```

---

## ЧАСТЬ 6: ПУБЛИКАЦИЯ В СТОРЫ

### Apple App Store

**До сабмита:**
- Apple Developer Account ($99/год) — регистрация 24-48ч
- Privacy Policy URL (ChatGPT + хост на Vercel)
- Скриншоты: 6.7", 6.5", 5.5"
- Тестовый аккаунт: demo@fencequoter.app / TestPassword123
- Кнопка "Restore Purchases" (отклонят без неё)

**Review:** 1-3 дня. Частые причины отказа для калькуляторов:
- Нет restore purchases
- Paywall слишком рано (дай попользоваться)
- Нет privacy policy
- Скриншоты не соответствуют UI

### Google Play

**До сабмита:**
- Google Play Console ($25)
- Первый билд — загрузить вручную (ограничение API)
- Data Safety форма
- Content Rating questionnaire

**Review:** 1-7 дней для нового аккаунта.

### Веб

```bash
npx expo export --platform web
vercel --prod
```
Доступна сразу, без review. Первые пользователи — пока сторы ревьюят.

---

## ЧАСТЬ 7: ПЕРВЫЕ ПРОДАЖИ

### До запуска (недели 1-4, параллельно с разработкой)

1. Вступить в 5+ Facebook-групп fence contractors (USA, UK, AU, CA)
2. Пост: "Строю калькулятор квоутов для fence contractors. Что нужно больше всего?" → emails
3. 30-сек видео с прототипа → TikTok, YouTube Shorts, Reels
4. Reddit: r/fencebuilding, r/Construction → "Я решал свою проблему..."

**Цель:** 50-100 emails до запуска.

### После запуска (неделя 5+)

1. Email списку: "Приложение готово! Первым 20 — бесплатный месяц Pro"
2. Посты в Facebook-группах с реальными скриншотами
3. Попросить 5-10 юзеров оставить отзыв в сторах
4. SEO-статья: "How to Price Your Fence Jobs in 2026"
5. YouTube: "I built an app for fence contractors in 5 weeks"

**Месяц 1:** 20-30 платящих ($1000-1500 MRR)
**Месяц 3:** 80-100 клиентов ($3500-5000 MRR)
**Месяц 6:** Запуск второго trade

---

## ЧАСТЬ 8: МАСШТАБИРОВАНИЕ

### Trade #2, #3...

После 50+ платящих на заборах → клонировать:
- Новые параметры формы (площадь стен для маляра, тип краски)
- Новые формулы в calculator.ts
- Новые seed-данные материалов
- Новый брендинг + App Store listing

Claude Code + ChatGPT клонируют за 3-5 дней (архитектура та же).

| Trade | Сложность | Рынок |
|---|---|---|
| Покраска | Простая | Огромный |
| Плитка | Средняя | Большой |
| Ландшафт | Средняя | Большой |
| Кровля | Средняя | Большой |
| Бетон | Простая | Средний |

### Конечная цель
Отдельные приложения → платформа "QuickQuote" с выбором trade при онбординге.

---

## ЧАСТЬ 9: ЧЕКЛИСТ "НЕ ЗАБУДЬ"

### Технические
- [ ] CLAUDE.md обновлять после каждой сессии
- [ ] RLS включён на ВСЕХ таблицах
- [ ] Storage RLS: write только в свою папку
- [ ] pdf_url хранит PATH, не URL
- [ ] Edge Functions: guard от повторной отправки
- [ ] Signed URL на 30 дней (не 7)
- [ ] Markup как целое число (20, не 0.20)
- [ ] Офлайн: форма сохраняется в AsyncStorage
- [ ] Restore Purchases кнопка
- [ ] Environment variables не хардкожены

### Бизнес
- [ ] Privacy Policy URL
- [ ] Terms of Service URL
- [ ] Support email (support@fencequoter.app)
- [ ] Домен (fencequoter.app)
- [ ] Лендинг на Vercel
- [ ] Тестовый аккаунт для Apple reviewer

### Перед сабмитом
- [ ] Скриншоты всех размеров
- [ ] App icon 1024×1024
- [ ] Описание подписки (содержимое, цена, отмена)
- [ ] Нет crash-ов при запуске
- [ ] Все кнопки работают

---

## ФАЙЛЫ ПРОЕКТА

Этот документ является частью пакета из 3 файлов:

1. **quote-calculator-build-strategy.md** — этот файл (общая стратегия)
2. **CLAUDE.md** — техническая спецификация для Claude Code (класть в корень проекта)
3. **001_initial.sql** — полная миграция Supabase (schema + RLS + storage + seed)

---

*Стратегия: Февраль 2026*
*Стек: Expo + Supabase + RevenueCat + Claude Code + ChatGPT*
*Первый trade: Fence Contractors*
*Цель: $5K MRR за 3 месяца*
