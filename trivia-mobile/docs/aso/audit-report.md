# ASO Audit Report (Pre-launch) — QazaQuiz

Дата: 2026-03-05
Область: Apple + Google, рынок KZ (RU+KK)
Тип: pre-launch audit

## P0 (Critical before store submission)

- Синхронизирован бренд в конфиге приложения: `expo.name = QazaQuiz`.
- Удален временный legal placeholder из экранов Terms/Privacy.
- Удален временный legal placeholder из RU/KK локалей.
- Подготовлен и зафиксирован baseline metadata package для Apple и Google.

## P1 (High impact for conversion)

- Добавлен мягкий in-app review поток через `expo-store-review`.
- Добавлен троттлинг по ключу `app_review_last_prompt_at` (не чаще 1 раза в 30 дней).
- Подготовлен checklist обязательных/рекомендуемых store assets.

## P2 (Post-launch optimization)

- Провести A/B тест icon + first screenshots после первых данных трафика.
- Расширить keyword coverage на базе фактических ranking reports.
- Добавить weekly review triage по отзывам в сторах.

## Provisional ASO Score

Полный ASO score по модели skill состоит из 4 блоков (metadata, ratings/reviews, keyword performance, conversion).

- Metadata Quality: доступно для оценки сейчас (pre-launch data ready).
- Ratings & Reviews: требует live-store данных.
- Keyword Performance: требует live ranking telemetry.
- Conversion Metrics: требует store impression/install данных.

Статус: **Provisional** (финализация после публикации и сбора live-метрик).

## What Was Changed in Codebase

- Updated: `app.json` (brand naming)
- Updated: `app/terms.tsx`, `app/privacy.tsx` (legal cleanup)
- Updated: `src/i18n/locales/ru.json`, `src/i18n/locales/kk.json` (legal cleanup)
- Added: `src/services/reviewPrompt.ts`
- Updated: `app/quiz/[id]/results.tsx` (review prompt trigger)
- Added docs: `docs/aso/*`
