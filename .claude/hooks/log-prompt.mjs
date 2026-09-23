#!/usr/bin/env node
// UserPromptSubmit hook: дописывает каждый промпт пользователя в AI_PROMPTS.md.
// Формат записи из ТЗ: "## HH:MM — <инструмент>" + промпт дословно.
// Хук ничего не пишет в stdout (stdout UserPromptSubmit попадает в контекст модели)
// и никогда не блокирует промпт: любые ошибки проглатываются.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SECRET_PATTERNS = [
  [/\b\d{6,12}:[A-Za-z0-9_-]{30,}\b/g, "<REDACTED:telegram-token>"],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "<REDACTED:api-key>"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, "<REDACTED:github-token>"],
  [/\bya29\.[A-Za-z0-9._-]{20,}\b/g, "<REDACTED:google-token>"],
  [/\bAKIA[0-9A-Z]{16}\b/g, "<REDACTED:aws-key>"],
  [/((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)\S+/gi, "$1<REDACTED>"],
];

function redact(text) {
  return SECRET_PATTERNS.reduce((t, [re, repl]) => t.replace(re, repl), text);
}

// Подпись инструмента. Модель можно добавить через AI_PROMPTS_LABEL, например "Claude Code / Opus".
const LABEL = process.env.AI_PROMPTS_LABEL || "Claude Code";
// Время пишем в часовом поясе автора, а не контейнера (облачные сессии работают в UTC).
const TIME_ZONE = process.env.AI_PROMPTS_TZ || "Europe/Moscow";

function localParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return { day: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

try {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  const input = JSON.parse(raw);
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) process.exit(0);

  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = join(root, "AI_PROMPTS.md");
  if (!existsSync(file)) writeFileSync(file, "# AI_PROMPTS\n\nЖурнал моих запросов к AI (дописывается автоматически hook-ом `.claude/hooks/log-prompt.mjs`).\n");

  const { day, time } = localParts(new Date());
  const dayHeader = `\n# ${day}\n`;
  const existing = readFileSync(file, "utf8");
  const header = existing.includes(dayHeader) ? "" : dayHeader;

  const entry = `${header}\n## ${time} — ${LABEL}\n\n${redact(prompt)}\n`;
  appendFileSync(file, entry);
} catch {}
process.exit(0);
