# AI Marketer Daily

> The daily intelligence brief for AI marketers worldwide.
> 8 minutes a day. Free forever.

Bilingual (EN / 中文) daily digest covering AI industry moves, growth insights, product launches, and one deep-dive marketing case — curated by Claude, reviewed by an editor, pushed to the web and Telegram every morning.

---

## 🚀 Quick preview (Demo Mode)

Zero config, no keys required. You need [Node.js](https://nodejs.org) v18+.

**Mac / Linux:**
```bash
./start-demo.sh
```

**Windows:**
```
start-demo.bat
```

Then open [http://localhost:3000](http://localhost:3000). The site renders from `src/data/demo-data.json` and never touches Supabase or Claude.

`Ctrl+C` to stop.

---

## 🗺️ Feature map

| Route | What it is |
| --- | --- |
| `/` | Today's issue — 4 sections in the dark "JE Labs" layout |
| `/archive` | All past issues, grouped by date (demo: only 2026-04-20) |
| `/admin?key=…` | Editorial console — edit / approve / publish articles |
| `POST /api/generate` | Claude + web search → drafts 11 articles into `articles` as `draft` |
| `POST /api/translate` | Batch EN → ZH via Claude Haiku, with a 28-term glossary |
| `POST /api/publish` | Flip day's drafts to `published`, upsert `daily_issues` |
| `POST /api/telegram/webhook` | Bot command handler (`/start`, `/lang_*`, `/time_*`, `/latest`, `/stop`) |
| `POST /api/telegram/push` | Send today's published issue to every active subscriber |

All write APIs require `Authorization: Bearer ${CRON_SECRET}`. The Telegram webhook validates Telegram's own `X-Telegram-Bot-Api-Secret-Token`.

---

## 🔧 Full setup (live mode)

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

Required:

| Var | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page (publishable key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — **server-only, never ship to browser** |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `CRON_SECRET` | Any random string; shared between cron, admin, and CLI |

Optional (Telegram bot):

| Var | Where to get it |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Chat with [@BotFather](https://t.me/BotFather) → `/newbot` |
| `TELEGRAM_WEBHOOK_SECRET` | Any random string; Telegram echoes it back on every update |

Then create the database schema in your Supabase SQL editor:

```bash
# Paste the contents of supabase/schema.sql into Supabase → SQL Editor
```

Seed it (optional):

```bash
npm run seed         # loads src/data/demo-data.json into Supabase
npm run seed:live    # loads src/data/latest-live-data.json (real sample pull)
```

Then:

```bash
npm install
npm run dev          # live mode, reads from Supabase
```

---

## 🤖 Generating real content

Once `ANTHROPIC_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` are set:

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-04-21"}'
```

Claude will web-search real headlines (TechCrunch, The Verge, Product Hunt, Hacker News, Lenny's Newsletter, etc.), return JSON, and the route upserts them into `articles` with `status='draft'`. Takes ~30–60 s and costs ~$0.05–$0.20 per run.

Then either review/edit in `/admin` or batch-translate + publish in one go:

```bash
curl -X POST http://localhost:3000/api/translate -H "Authorization: Bearer ${CRON_SECRET}" \
     -H "Content-Type: application/json" -d '{"date":"2026-04-21"}'
curl -X POST http://localhost:3000/api/publish -H "Authorization: Bearer ${CRON_SECRET}" \
     -H "Content-Type: application/json" -d '{"date":"2026-04-21"}'
```

---

## 💬 Telegram bot

After deploying (e.g. to Vercel), register the webhook:

```bash
npx tsx --env-file=.env.local scripts/setup-telegram.ts \
  --url https://your-app.vercel.app/api/telegram/webhook
```

Users then `/start` your bot and get daily pushes at their chosen time.

**Commands:**

| Command | Effect |
| --- | --- |
| `/start` | Subscribe + welcome message |
| `/lang_en`, `/lang_zh` | Switch push language |
| `/time_8`, `/time_9`, `/time_10` | Choose push time (local) |
| `/latest` | Pull today's brief on demand |
| `/stop` | Unsubscribe (`is_active=false`) |
| `/help` | Re-show the command menu |

---

## ☁️ Deploy on Vercel

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new).
3. Add every env var from `.env.example` to the Vercel project (Production + Preview scope).
4. Deploy. `vercel.json` wires up two crons automatically:
   - `0 6 * * *` UTC → `/api/generate` (drafts tomorrow's issue)
   - `0 17 * * *` UTC → `/api/telegram/push` (delivers today's issue)
5. Register the Telegram webhook against your production URL (command above).

> **Timezone note:** Vercel runs crons in UTC. To date articles in US Pacific, add `TZ=America/Los_Angeles` to your project env vars.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        sources & delivery                          │
│                                                                    │
│ Claude (web search) ──┐                        ┌── Telegram Bot    │
│                       │                        │                   │
│ Manual editor (/admin)│ POST /api/generate     │ POST webhook      │
└───────────────────────┼────────────────────────┼───────────────────┘
                        ▼                        ▲
                 ┌────────────────────────────────────────┐
                 │  Next.js App Router (Vercel + Node)    │
                 │  /api/{generate,translate,publish}     │
                 │  /api/telegram/{webhook,push}          │
                 └──────────────┬─────────────────────────┘
                                ▼
                 ┌────────────────────────────────────────┐
                 │  Supabase Postgres                     │
                 │  • articles (draft / approved / pub)   │
                 │  • daily_issues                        │
                 │  • telegram_subscribers                │
                 └────────────────────────────────────────┘
                                │
                                ▼
                 ┌────────────────────────────────────────┐
                 │  Public reader  /  /archive  (SSR)     │
                 │  Falls back to demo-data.json when     │
                 │  Supabase env vars are missing.        │
                 └────────────────────────────────────────┘
```

**Key files:**

```
src/
├── app/
│   ├── page.tsx                 main issue
│   ├── archive/page.tsx         by-date archive
│   ├── admin/page.tsx           editorial console
│   └── api/
│       ├── generate/route.ts    Claude + web_search_20250305
│       ├── translate/route.ts   Claude Haiku + glossary
│       ├── publish/route.ts     status flip
│       └── telegram/
│           ├── webhook/route.ts bot command handler
│           └── push/route.ts    daily broadcast
├── components/
│   ├── DailyBrief.tsx           timeline cards
│   ├── GrowthInsight.tsx        quoted-insight cards
│   ├── LaunchRadar.tsx          product launches, 2-up grid
│   ├── DailyCase.tsx            full-width markdown case study
│   ├── Sidebar.tsx              today's highlights
│   └── admin/
│       ├── AdminClient.tsx      auth gate + toolbar + tabs
│       └── ArticleEditor.tsx    one editable card per article
├── lib/
│   ├── claude.ts                Anthropic wrapper + generation prompt
│   ├── telegram.ts              raw HTTP wrapper + chunker
│   ├── telegramFormat.ts        HTML formatter for daily push
│   ├── data-source.ts           Supabase OR demo-data.json
│   ├── supabase.ts              browser + server clients
│   └── LanguageContext.tsx      EN/ZH toggle
└── data/
    ├── demo-data.json           frozen sample (2026-04-20)
    └── latest-live-data.json    last live-pulled snapshot
```

---

## 🎨 Design system

All styles live in `src/app/globals.css`. Palette is dark-first with green accent:

| Token | Value | Used for |
| --- | --- | --- |
| `--green` | `#00F5A0` | Primary accent, pulsing date dot, "approved" state |
| `--bg-body` | `#080a0e` → `#0c0f16` gradient | Page background |
| `--surface-1/2/3` | Translucent dark | Card fills |
| `--text-1/2/3/4` | `#f0f0ea` → `#303028` | Text hierarchy |

Fonts: **Space Grotesk** (body) + **Space Mono** (labels & timestamps), loaded via `<link>` in `layout.tsx`.

---

## 📜 Scripts

```bash
npm run dev                    # local dev (live mode)
npm run demo                   # local dev with NEXT_PUBLIC_DEMO_MODE=true
npm run build                  # production build
npm run start                  # serve the production build
npm run lint                   # eslint
npm run seed                   # seed Supabase from demo-data.json
npm run seed:live              # seed Supabase from latest-live-data.json
```

---

## 🛡️ Credits & license

Built by JE Labs. Free forever — no ads, no paywall.

Content is generated by Anthropic Claude and curated by a human editor. News sources are cited with working links on every article; please follow the link for the primary source.
