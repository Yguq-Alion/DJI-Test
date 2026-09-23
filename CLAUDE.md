# CLAUDE.md

Тестовое задание: **Sales Performance Dashboard** — full-stack аналитика продаж менеджеров.
.NET 10 (ASP.NET Core Controllers, EF Core 10, Npgsql) · PostgreSQL · React + TypeScript (Vite, shadcn/ui, Tailwind v4, Nivo, TanStack Query, nuqs, Motion) · Docker Compose.

**Прежде чем писать код — прочитай `docs/decisions.md`.** Там требования и все принятые архитектурные решения, формулы метрик, модель данных и API-контракт. Не меняй решения молча: если реализация требует отступить — остановись и спроси.

## Правила работы

- Работаем по фазам из `docs/decisions.md` §10. Одна фаза — один осмысленный коммит (или несколько небольших). После фазы — остановиться, кратко отчитаться, дождаться ревью.
- Все вычисления и фильтрация — на сервере. Фронт не агрегирует продажи.
- Логику периодов (пресеты, часовой пояс, предыдущий период) держать только в `PeriodResolver`.
- Правило сторно (Refunded) и формулы — строго по `docs/decisions.md` §1. Любое изменение формулы = правка документа + тест.
- Простота важнее паттернов: никаких Repository/CQRS/MediatR/AutoMapper без конкретной причины.
- Перед коммитом: сборка, тесты и линтер должны проходить. Не отключать и не пропускать тесты.
- Никаких секретов в репозитории. Строки подключения — через переменные окружения compose.
- `AI_PROMPTS.md` дописывается hook-ом автоматически (промпты пользователя). Hook не видит ответы пользователя на уточняющие вопросы агента (AskUserQuestion) — их дописывать вручную тем же форматом. Остальное не редактировать и не переформатировать.
- Ответы пользователю — на русском. Код, идентификаторы, коммиты — на английском.

## Команды

```bash
docker compose up --build                  # весь стек → http://localhost:8080

# backend (из backend/)
dotnet build                               # сборка
dotnet test                                # юнит + интеграционные (Testcontainers, нужен Docker)
dotnet ef migrations add <Name> -p SalesDashboard.Api -o Data/Migrations

# frontend (из frontend/)
npm run dev                                # Vite dev-сервер, /api → http://localhost:5157
npm run typecheck && npm run lint && npm run format:check
npm test                                   # Vitest + RTL + MSW
npm run test:e2e                           # Playwright против поднятого compose (http://localhost:8080)
```
