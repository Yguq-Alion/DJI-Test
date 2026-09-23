# Архитектурные решения — Sales Performance Dashboard

Конспект требований тестового задания и принятых решений. Источник правды для разработки:
при расхождении кода и этого файла — сначала обсуждаем, потом меняем одно из двух.

Статусы: **✅ принято** (решение автора) · **🔧 по умолчанию** (стандартный выбор, не обсуждался отдельно, можно пересмотреть).

---

## 0. Требования задания (конспект)

- Timebox **8 часов**, desktop-only (~1440×900), авторизация не нужна.
- Стек обязателен: **C# / .NET 8+ / ASP.NET Core / EF Core / REST / async**, **React + TypeScript**, **PostgreSQL** (миграции обязательны), **Docker Compose**.
- Запуск: `docker compose up --build` → сразу заполненный рабочий dashboard. Никаких ручных шагов (PgAdmin, SQL, отдельный seed, установка зависимостей).
- Сущности: Manager, Customer, Category, Product, Sale, SaleItem. Статусы минимум Paid / Cancelled / Refunded.
- Метрики: Revenue, Gross Profit, Margin, Average Check. Сравнение с предыдущим периодом.
- Seed: 15–25 менеджеров, 50–100 клиентов, несколько категорий, несколько десятков товаров, 2 000–5 000 продаж, 6–12 месяцев. Неравномерно и реалистично: сильные/слабые менеджеры, разные чеки и маржа, сезонность, отмены и возвраты, крупные и мелкие сделки, периоды без продаж. Воспроизводимо.
- Dashboard: KPI-карточки (выручка, валовая прибыль, маржа, кол-во продаж, средний чек, лучший менеджер), период (сегодня / 7 дней / 30 дней / этот месяц / прошлый месяц / from–to), рейтинг менеджеров (минимум GP и Average Check), динамика, категории и продукты, последние продажи.
- Вычисления и фильтрация — **на сервере**. Без N+1, async I/O, валидация, понятные ошибки.
- Состояния: initial loading, loading при смене периода, ошибка API, пустой период, пустой блок. Микроанимации уместны.
- Edge cases: Cancelled, Refunded, менеджер без продаж, равные результаты, продажа ровно на границе диапазона, одна очень крупная продажа, много мелких, разные себестоимости.
- Тесты: backend — KPI, фильтр периода, рейтинг, статусы; frontend — смена периода, переключение рейтинга, loading/error.
- Обязательные файлы: `README.md`, `AI_PROMPTS.md`, `AI_NOTES.md`. Осмысленная история коммитов.
- Не нужно: auth, users, mobile, admin panel, k8s, cloud deploy, микросервисы.

---

## 1. Бизнес-правила

| # | Решение | Статус |
|---|---|---|
| 1.1 | **Refunded = сторно.** Продажа попадает в выручку в дату продажи (`SoldAt`), возврат вычитает её в дату возврата (`RefundedAt`). Возврат всегда **полный**. | ✅ |
| 1.1a | Себестоимость возврата: **по умолчанию товар вернулся на склад** (`ItemsRestocked = true`) → себестоимость сторнируется. Возможна **полная потеря товара** (`ItemsRestocked = false`) → себестоимость не сторнируется, потеря = вся себестоимость. | ✅ |
| 1.1b | **Доп. расходы на возврат** (логистика, упаковка, экспертиза, прочее) — отдельные записи `RefundCost`, уменьшают GP в дату возврата. | ✅ |
| 1.1c | **Cancelled** не влияет ни на какие денежные метрики и не входит в количество продаж. | ✅ |
| 1.2 | **Предыдущий период** = отрезок той же длины непосредственно перед текущим. «Этот месяц» (1–23 сен) ↔ 1–23 авг; «прошлый месяц» ↔ позапрошлый месяц целиком. | ✅ |
| 1.3 | Время хранится в UTC (`timestamptz`). Границы периодов, «сегодня» и сетка графика считаются **в часовом поясе браузера**: фронт передаёт IANA tz (`Intl.DateTimeFormat().resolvedOptions().timeZone`). Интервал полуоткрытый `[from 00:00, to+1d 00:00)` в этом поясе. | ✅ |
| 1.4 | **Лучший менеджер** = максимум чистого GP (сторно и расходы на возвраты учтены). Карточка показывает GP, Revenue и refund rate. Tie-break: GP ↓, Revenue ↓, имя ↑. | ✅ |
| 1.5 | **Количество продаж и Average Check — по дате продажи**: учитываются продажи со `SoldAt` в периоде и статусом Paid или Refunded. | ✅ |

### Формулы (период P, предыдущий период считается так же)

```
Sold(P)        = продажи с SoldAt ∈ P и Status ∈ {Paid, Refunded}
Refunds(P)     = возвраты с RefundedAt ∈ P

GrossRevenue   = Σ SaleItem.Qty × UnitPrice          по Sold(P)
RefundedAmount = Σ SaleItem.Qty × UnitPrice          по продажам из Refunds(P)
Revenue (net)  = GrossRevenue − RefundedAmount        ← KPI «Выручка»

COGS           = Σ Qty × UnitCost по Sold(P)
               − Σ Qty × UnitCost по Refunds(P) где ItemsRestocked = true
RefundCosts    = Σ RefundCost.Amount по Refunds(P)
GrossProfit    = Revenue − COGS − RefundCosts

Margin         = GrossProfit / Revenue                (null, если Revenue ≤ 0)
SalesCount     = |Sold(P)|
AverageCheck   = GrossRevenue / SalesCount            (null, если SalesCount = 0)
RefundRate     = |{s ∈ Sold(P) : s.Status = Refunded}| / SalesCount   🔧
Δ к пред. периоду = (cur − prev) / |prev|             (null, если prev = 0 → UI «нет данных для сравнения»)
```

Следствие: в коротком периоде Revenue/GP могут быть отрицательными (возвраты старых продаж) — это корректно и должно отображаться.

---

## 2. Модель данных

| # | Решение | Статус |
|---|---|---|
| 2.1 | Деньги: `numeric(18,2)` ↔ `decimal`. Одна валюта — RUB. | ✅ |
| 2.2 | Возврат — отдельная сущность **`Refund` 1:1 к Sale** + **`RefundCost`** 1:N к Refund. `Sale.Status = Refunded` ⇔ существует Refund (инвариант в домене + тест). | ✅ |
| 2.3 | **Без денормализации**: суммы всегда считаются из `SaleItem`. | ✅ |
| 2.3a | `SaleItem` фиксирует `UnitPrice` и `UnitCost` на момент продажи (snapshot). | 🔧 |
| 2.4 | Статусы/типы — **C# `enum` + нативный PostgreSQL enum** через `UseNpgsql(..., o => o.MapEnum<SaleStatus>("sale_status"))` (EF 9+). Платформа **.NET 10 LTS + EF Core 10**. Union types C# 15 — только упоминание в README (preview в .NET 11). | ✅ |

### Сущности

```
Manager      Id, FullName, Team, Position, IsActive, AvatarColor (initials считаются из имени)
Customer     Id, Name, Company, Segment (enum customer_segment: Smb | MidMarket | Enterprise)
Category     Id, Name
Product      Id, Name, Sku, CategoryId, ListPrice, BaseCost
Sale         Id, ManagerId, CustomerId, SoldAt (timestamptz), Status (enum sale_status: Paid | Cancelled | Refunded)
SaleItem     Id, SaleId, ProductId, Quantity (int > 0), UnitPrice, UnitCost
Refund       Id, SaleId (unique), RefundedAt (timestamptz, ≥ SoldAt), ItemsRestocked (bool, default true), Reason
RefundCost   Id, RefundId, Type (enum refund_cost_type: Logistics | Packaging | Inspection | Other), Amount
```

CHECK-ограничения: `Quantity > 0`, `UnitPrice ≥ 0`, `UnitCost ≥ 0`, `Amount ≥ 0`, `RefundedAt ≥ SoldAt` (через триггер не делаем — проверка в домене и тестах).

### Индексы (🔧 предложено, проверить `EXPLAIN ANALYZE` после seed)

| Индекс | Зачем |
|---|---|
| `sales (sold_at, id)` | диапазон по периоду + keyset-пагинация последних продаж (оба направления) |
| `sales (manager_id, sold_at)` | рейтинг / фильтр по менеджеру |
| `refunds (refunded_at)` | сторно-агрегаты по дате возврата |
| `refunds (sale_id) UNIQUE` | 1:1 |
| `sale_items (sale_id)`, `sale_items (product_id)` | FK + агрегаты по категориям/продуктам |
| `refund_costs (refund_id)`, `products (category_id)` | FK |

---

## 3. Seed

| # | Решение | Статус |
|---|---|---|
| 3.1 | Генератор на **C# с фиксированным `new Random(seed)`**: профили менеджеров (сильный / слабый / высокий чек / низкая маржа / отпуск-пробел), сезонность по месяцам и дням недели, ~85% Paid / ~8% Cancelled / ~7% Refunded, у части возвратов `ItemsRestocked = false` и 0–3 `RefundCost`. Несколько крупных сделок-выбросов. | ✅ |
| 3.2 | **Даты относительно «сегодня»** (12 месяцев назад → сегодня), чтобы пресеты «Сегодня / 7 дней» не были пустыми. Воспроизводимость: одинаковый seed → одинаковые данные при одной и той же дате запуска. | 🔧 |
| 3.3 | Миграции (`Database.MigrateAsync()`) и seed — **на старте backend**, seed только если таблицы пустые; управляется флагом конфигурации. В README: в production так не делаем. | ✅ |
| 3.4 | Вставка пачками (`AddRange` + один `SaveChanges`, либо Npgsql binary COPY, если медленно). | 🔧 |

---

## 4. Backend

| # | Решение | Статус |
|---|---|---|
| 4.1 | **Controllers** (`[ApiController]`). | ✅ |
| 4.2 | **Один проект, папки по фичам** + отдельный тестовый проект. | ✅ |
| 4.3 | **EF LINQ** (AsNoTracking, проекции) для простого; **raw SQL через `Database.SqlQuery<T>`** для сторно-агрегатов и сетки графика (`generate_series` + `AT TIME ZONE`). Dapper не используем. | ✅ |
| 4.4 | **Эндпоинт на каждый блок** dashboard. | ✅ |
| 4.5 | Валидация: **DataAnnotations + `IValidatableObject`** (from ≤ to, диапазон ≤ 2 лет, валидный IANA tz) → 400 `ValidationProblemDetails`. Глобальный **`IExceptionHandler` → ProblemDetails** (500, `traceId`). | ✅ |
| 4.6 | `PeriodResolver` — единственное место логики периодов (пресеты, tz, предыдущий период). Чистый класс, покрыт юнит-тестами. Время через `TimeProvider` (тестируемость). | 🔧 |

### Структура

```
backend/
  SalesDashboard.Api/
    Domain/              сущности, enum-ы
    Data/                AppDbContext, Configurations/, Migrations/, Seed/
    Common/              PeriodResolver, ProblemDetails, валидация запросов
    Features/
      Dashboard/         KpiController, TimeseriesController, …, *Query.cs (SQL/LINQ)
      Managers/          рейтинг
      Sales/             последние продажи
  SalesDashboard.Tests/  xUnit: Unit/ + Integration/ (Testcontainers)
```

---

## 5. API-контракт

Общие параметры периода: `?preset=today|7d|30d|thisMonth|lastMonth&tz=Europe/Moscow` **или** `?from=2026-09-01&to=2026-09-23&tz=...` (даты — локальные календарные дни). Каждый ответ содержит `period: {from, to, tz}` и `previousPeriod: {from, to}`.

| Эндпоинт | Ответ |
|---|---|
| `GET /api/dashboard/kpi` | revenue, grossRevenue, grossProfit, margin, salesCount, averageCheck, refundRate, refundedAmount — каждый `{value, previous, deltaPct}`; `bestManager {id, name, grossProfit, revenue, refundRate}` |
| `GET /api/dashboard/timeseries?granularity=auto\|hour\|day\|week\|month` | `granularity` (итоговая), `points[] {bucketStart, revenue, grossProfit, salesCount}` — пустые бакеты = 0 |
| `GET /api/managers/ranking?sortBy=grossProfit\|averageCheck` | `items[] {rank, manager, salesCount, revenue, grossProfit, averageCheck, margin, refundRate, deltaPct}` — менеджеры без продаж в конце с нулями |
| `GET /api/dashboard/categories` | `items[] {category, revenue, grossProfit, margin, share}` |
| `GET /api/dashboard/products/top?limit=10` | `items[] {product, category, qty, revenue, grossProfit}` |
| `GET /api/sales/recent?limit=20&cursor=&status=&managerId=` | keyset по `(soldAt desc, id desc)`: `items[] {id, soldAt, manager, customer, items[], status, amount, grossProfit, refund?}`, `nextCursor` |
| `GET /health` | healthcheck для compose |

| # | Решение | Статус |
|---|---|---|
| 5.1 | **Пресет → даты считает бэк** (`PeriodResolver`), в ответе — resolved-периоды. | ✅ |
| 5.2 | Гранулярность: **auto + ручное переопределение**. Auto: ≤ 1 дня → час, ≤ 62 дней → день, ≤ 26 недель → неделя, иначе месяц. | ✅ |
| 5.3 | Последние продажи: **keyset-пагинация + фильтры** статус/менеджер, «Загрузить ещё». | ✅ |

---

## 6. Frontend

| # | Решение | Статус |
|---|---|---|
| 6.1 | **Vite + React + TypeScript** (strict). | 🔧 |
| 6.2 | **shadcn/ui + Tailwind v4**, светлая + тёмная тема. | ✅ |
| 6.3 | Графики — **Nivo**. Тема Nivo берёт цвета из CSS-переменных темы. ⚠️ Уточнено при реализации: вместо комбинированного графика с двумя осями Y — Revenue и GP линиями на одной денежной оси, количество продаж — отдельным столбчатым графиком под ним с той же осью X (две шкалы на одном графике вводят в заблуждение). Палитра проверена валидатором CVD/контраста для светлой и тёмной темы. | ✅ |
| 6.4 | **TanStack Query** (`placeholderData: keepPreviousData`, чтобы не мигать при смене периода) + **фильтры в URL через nuqs** (period, sortBy, granularity). Zustand/Redux не нужны. | ✅ |
| 6.5 | **Motion**: stagger появления KPI, animated counters, layout-анимация перестановки рейтинга, transitions таблицы; `prefers-reduced-motion`. | ✅ |
| 6.6 | Каждый блок сам отвечает за loading (skeleton) / error (retry) / empty (объяснение). Ошибка одного блока не ломает остальные. | 🔧 |
| 6.7 | Типы API — вручную в `src/api/types.ts` (или генерация из OpenAPI, если останется время). | 🔧 |

---

## 7. Docker

| # | Решение | Статус |
|---|---|---|
| 7.1 | `frontend`: multi-stage (node build → **nginx:alpine**), nginx проксирует `/api` → backend. Всё на **http://localhost:8080**, без CORS. | ✅ |
| 7.2 | `postgres:17-alpine` + `backend` с healthcheck; порядок через `depends_on: condition: service_healthy`. Именованный volume для БД. | 🔧 |

---

## 8. Тесты

| # | Решение | Статус |
|---|---|---|
| 8.1 | **xUnit**: юнит (PeriodResolver, формулы KPI, tie-break) + интеграционные через **WebApplicationFactory + Testcontainers PostgreSQL** (сторно, границы дат, tz, Cancelled, менеджер без продаж, равные результаты, крупная продажа). | ✅ |
| 8.2 | **Vitest + React Testing Library + MSW** (смена периода, переключение рейтинга, loading/error/empty) **+ Playwright e2e** smoke на поднятом compose. | ✅ |

---

## 9. Процесс работы с AI

| # | Решение | Статус |
|---|---|---|
| 9.1 | Основной инструмент — **Claude Code**. Контекст проекта — `CLAUDE.md` + этот файл. | ✅ |
| 9.2 | `AI_PROMPTS.md` ведётся **автоматически** hook-ом `UserPromptSubmit` (`.claude/hooks/log-prompt.mjs`): время (МСК), инструмент, промпт дословно, маскирование секретов. Работает и в облачных сессиях. Ответы на уточняющие вопросы агента hook не видит — они дописываются вручную. Сессия проектирования (этот документ) перенесена туда вручную. | ✅ |
| 9.3 | `AI_NOTES.md` — пишется в конце, по фактам из `AI_PROMPTS.md` и git-истории. | 🔧 |

## 10. План коммитов (из ТЗ)

1. `initial project structure` — compose, скелеты backend/frontend, healthchecks
2. `add sales domain and seed` — сущности, миграции, генератор
3. `implement analytics API` — эндпоинты + backend-тесты
4. `build dashboard UI` — layout, KPI, рейтинг, таблица, состояния
5. `add charts and animations`
6. `add tests` — frontend + e2e; README, AI_NOTES
