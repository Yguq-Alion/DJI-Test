# Стартовый промпт для Claude Code

Скопировать текст ниже и отправить первым сообщением в новой сессии Claude Code в корне репозитория.
Hook автоматически запишет его в `AI_PROMPTS.md`.

---

Мы начинаем тестовое задание Sales Performance Dashboard (timebox 8 часов). Все требования и принятые мной архитектурные решения лежат в `docs/decisions.md`, правила работы — в `CLAUDE.md`. Прочитай оба файла целиком, прежде чем что-то делать.

Контекст: решения по бизнес-правилам (сторно возвратов с доп. расходами и опцией потери товара, предыдущий период той же длины, периоды в поясе браузера, лучший менеджер по чистому GP), модели данных (numeric(18,2), Refund 1:1 + RefundCost, без денормализации, C# enum + PG enum через MapEnum), seed (C# Random(seed), на старте backend), backend (Controllers, одна сборка с папками по фичам, EF LINQ + SqlQuery для аналитики, эндпоинт на блок, DataAnnotations + ProblemDetails), API (PeriodResolver на бэке, auto-гранулярность, keyset-пагинация), frontend (shadcn/ui + Tailwind v4, Nivo, TanStack Query + nuqs, Motion), docker (nginx + прокси /api) и тесты (xUnit + Testcontainers, Vitest + RTL + MSW, Playwright) уже приняты — не пересматривай их без явной причины.

Задача сейчас — только **фаза 1: `initial project structure`**:

1. `backend/`: solution с `SalesDashboard.Api` (.NET 10, Controllers, Npgsql EF Core, ProblemDetails, `IExceptionHandler`, `/health`, `TimeProvider` в DI) и `SalesDashboard.Tests` (xUnit). Пока без доменной модели.
2. `frontend/`: Vite + React + TypeScript strict, Tailwind v4, shadcn/ui (init + базовые компоненты), TanStack Query, nuqs, Nivo, Motion; ESLint + Prettier; Vitest + RTL + MSW настроены; пустой layout dashboard.
3. `docker-compose.yml`: postgres (healthcheck, volume), backend (healthcheck по `/health`), frontend (multi-stage build → nginx, прокси `/api` → backend), всё на `http://localhost:8080`. Никаких ручных шагов.
4. Дополни раздел «Команды» в `CLAUDE.md` реальными командами сборки, тестов и линтера.

Перед тем как писать код, покажи короткий план фазы 1 (структура папок, пакеты с версиями) и дождись моего «ок». После реализации: убедись, что `docker compose up --build` поднимает все три сервиса и `/api` доступен через nginx, что сборка и тесты проходят, затем сделай коммит `initial project structure` и остановись с кратким отчётом: что сделано, что проверено, какие отступления от `docs/decisions.md` (если были).
