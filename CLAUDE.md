# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # prisma generate && next build
npm run lint         # ESLint (Next.js core-web-vitals + typescript presets)
npm run test         # vitest run (all tests)
npx vitest run __tests__/crisisDetector.test.ts  # Run single test
prisma db push       # Push schema changes (non-interactive, use instead of migrate dev)
prisma generate      # Regenerate Prisma client
```

## Architecture

**Stack:** Next.js 16 + React 19, TypeScript (strict), Tailwind CSS v4, Prisma 5.22 (MySQL), OpenAI gpt-4.1-mini

### Core Flow

The app is an AI companion chat application. The main chat endpoint (`app/api/chat/route.ts`, ~654 lines) handles:
1. Rate limiting (15 req/min per IP) and subscription enforcement
2. File upload RAG (extract → chunk → relevance score → inject into prompt)
3. Dynamic system prompt built from user age group, language, persona, weather, memory (`app/lib/chat/promptBuilder.ts`)
4. Two-stage crisis detection: keyword regex (~0.1ms) → AI classification (`app/lib/crisis/`)
5. Streaming response via OpenAI
6. Post-stream: schedule extraction, summarization, memory update, daily insight

### Key Directories

- `app/api/` — API routes (auth, chat, conversations, users, admin, cron, notifications, subscription)
- `app/components/` — Client components (ChatPage, SideBar, SettingsModal are the largest)
- `app/context/` — ConversationContext, ThemeContext
- `app/hooks/` — useChatStream (streaming + file upload), useNotifications, useVoice, useSafeMode
- `app/lib/ai/` — Prompt building, chunking, summarization, title generation
- `app/lib/crisis/` — Crisis detection, safe mode, intervention notifications, account restriction
- `app/lib/language/` — Language detection (zh/ja/ko/en) and locale prompts
- `__tests__/` — Vitest tests (promptBuilder, gamification, crisisDetector)

### Authentication

Passwordless OTP via email (nodemailer). User ID stored in localStorage (`userId`). Admin routes use `ADMIN_SECRET` query param. Cron routes use `CRON_SECRET` bearer token.

### Crisis Safety System

Two-stage detection in `app/lib/crisis/crisisDetector.ts` with multilingual keyword support. Safe mode replaces the entire system prompt and blocks post-stream processing. `X-Safe-Mode` response header signals the frontend. Risk level ≥ 2 overrides dataControl=off.

### Subscription Model

Free/Pro/Premium plans gate: dailyMessageLimit, maxFileUploads, maxFileSizeMB, memoryEnabled, customAiPersonality, advancedAnalytics.

## Conventions

- **API route params** (Next.js 15+): `{ params }: { params: Promise<{ id: string }> }` — must `await params`
- **Prisma client** imports from `app/generated/prisma` (custom output path)
- **Prisma singleton** via `app/lib/db.ts`
- **Path aliases:** `@/*` maps to project root
- **Styling:** Tailwind utilities in JSX, dark mode via `dark:` prefix, global CSS only in `globals.css`
- **Components:** Server Components by default, `'use client'` only when needed
- **Type imports:** Use `import type` for type-only imports

## Database

MySQL via Prisma. Schema at `prisma/schema.prisma`. Key models: User, Conversation, Message, DailyInsight, CrisisEvent, SafeModeLog, Plan, Subscription, Notification, ScheduleItem, GrowthReport, DailyChallenge.

User model has notable fields: `safeMode`, `dataControl`, `restricted`, `memory` (JSON), `profile` (JSON), `pushSubscription` (JSON).
