# Daily Issue Pipeline

Automated bilingual AI Marketer Daily issue generation. Runs at UTC 17:00 each day via GitHub Actions (`.github/workflows/daily-issue.yml`).

## Flow

```
fetch (HN / Reddit / GitHub Trending / SEC EDGAR / RSS / manual-queue.json)
  → normalize (dedupe URLs, strip tracking, 24h cutoff)
    → dedup (vs last 7 days of issues/*.json)
      → section-select (rule-based by source_group)
        → generate (Claude Sonnet 4.6, one call per section, prompt-cached system)
          → validate (Zod on Article schema)
            → write (src/data/issues/<date>.json + latest.json + index.json)
              → commit + push (Actions only, if src/data/ diffed)
                → Vercel redeploys
```

## Local commands

```bash
# Full run — requires ANTHROPIC_API_KEY in .env.local or shell
npm run generate:daily

# Dry run — no Claude calls, no file writes; still hits live source APIs
npm run generate:daily -- --dry-run

# Target a specific date (useful for backfill)
npm run generate:daily -- --date 2026-04-23
```

## Repo secrets required

- `ANTHROPIC_API_KEY` — add under Settings → Secrets and variables → Actions.

## Adding / fixing sources

- **RSS feeds**: edit `sources/rss.ts` → `RSS_FEEDS`. Each entry maps to a `source_group`. Broken feeds log a warning and do not fail the run.
- **SEC tickers**: edit `sources/sec-edgar.ts` → `WATCHED_CIKS`.
- **Reddit subs**: edit `sources/reddit.ts` → `SUBS`.
- **Manual items** (Growth Insight white-list, regulatory blips, anything without a feed): append to `src/data/manual-queue.json`:

```json
{
  "items": [
    {
      "source_group": "growth_x_accounts",
      "source_name": "@someone",
      "source_url": "https://x.com/someone/status/...",
      "title": "...",
      "raw_text": "full post text for Claude context",
      "published_at": "2026-04-23T14:00:00Z",
      "lang": "en"
    }
  ]
}
```

Manual items feed straight into the same normalize → dedup → select → generate path. You can leave items in the queue indefinitely — the 24h freshness filter in `normalize.ts` drops stale entries automatically.

## Section targets

Defined in `index.ts` → `DEFAULT_TARGETS`:

| Section | min | max | Notes |
|---|---|---|---|
| daily_brief | 4 | 6 | Must cover ≥ 4 companies / ≥ 3 event types |
| growth_insight | 0 | 2 | Zero OK — "宁缺毋滥" |
| launch_radar | 1 | 2 | One heavyweight + one indie |
| daily_case | 1 | 2 | Prefer first-party + deep media |

## Prompt

`prompts.ts` holds the system prompt and per-section user-prompt builder. The system prompt is cached with `cache_control: ephemeral` so the four per-run Claude calls share it. Iterate on prompts here and rerun with `--dry-run` to preview section selection, or hit the live API for a full run.

## Failure modes

- **Fetch failures**: per-source try/catch → empty list, logged as `source.<name>.error`. Pipeline continues.
- **Generation parse failure**: aborts the run, no write, no commit. Check `generate.parse.error` in logs.
- **Validation failure**: Zod error, aborts before write.
- **Publish gate**: at least one article required (`assertPublishable`). Empty issue = fail loudly.
- **Commit-only-if-changed**: the Actions commit step is skipped if `src/data/` has no diff after the run.
