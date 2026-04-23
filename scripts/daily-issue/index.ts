import process from 'node:process';
import Anthropic from '@anthropic-ai/sdk';
import type { Article, ArticleSection } from '../../src/lib/types';
import type { Candidate, PipelineConfig } from './types';
import { fetchHackerNews } from './sources/hackernews';
import { fetchReddit } from './sources/reddit';
import { fetchGithubTrending } from './sources/github-trending';
import { fetchSecEdgar } from './sources/sec-edgar';
import { fetchRss } from './sources/rss';
import { fetchTheRundown } from './sources/therundown';
import { fetchXApi } from './sources/x-api';
import { fetchManualQueue } from './sources/manual-queue';
import { normalize } from './normalize';
import { dedup } from './dedup';
import { selectBySection } from './section-select';
import { generateSection } from './generate';
import { assertPublishable, validateArticles } from './validate';
import { writeIssue } from './write';
import { log } from './log';

function parseArgs(argv: string[]): { date?: string; dryRun: boolean; rerun: boolean } {
  const out: { date?: string; dryRun: boolean; rerun: boolean } = { dryRun: false, rerun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--date') out.date = argv[i + 1];
    else if (a === '--rerun') out.rerun = true;
  }
  return out;
}

function todayUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
}

const DEFAULT_TARGETS: Record<ArticleSection, { min: number; max: number }> = {
  daily_brief: { min: 6, max: 6 },
  growth_insight: { min: 1, max: 2 },
  launch_radar: { min: 2, max: 2 },
  daily_case: { min: 1, max: 1 },
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const rootDir = process.cwd();

  const config: PipelineConfig = {
    targetDate: args.date ?? todayUTC(now),
    fetchWindowHours: 24,
    fetchBufferHours: 1,
    dedupWindowDays: 7,
    sectionTargets: DEFAULT_TARGETS,
    dryRun: args.dryRun,
    model: 'claude-sonnet-4-6',
  };
  log.info('pipeline.start', { config });

  // 1. Fetch — each fetcher filters by lower bound only, so we tell them to
  // look back `windowHours + bufferHours` so the [now-25h, now-1h] window is
  // fully covered before normalize trims both ends.
  const fetchOpts = {
    windowHours: config.fetchWindowHours + config.fetchBufferHours,
    now,
  };
  const fetched = await Promise.all([
    fetchHackerNews(fetchOpts).catch((e) => {
      log.error('source.hackernews.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchReddit(fetchOpts).catch((e) => {
      log.error('source.reddit.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchGithubTrending().catch((e) => {
      log.error('source.github.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchSecEdgar(fetchOpts).catch((e) => {
      log.error('source.sec.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchRss(fetchOpts).catch((e) => {
      log.error('source.rss.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchTheRundown(fetchOpts).catch((e) => {
      log.error('source.therundown.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchXApi(fetchOpts).catch((e) => {
      log.error('source.x.error', { err: String(e) });
      return [] as Candidate[];
    }),
    fetchManualQueue({ rootDir, now }).catch((e) => {
      log.error('source.manual.error', { err: String(e) });
      return [] as Candidate[];
    }),
  ]);
  const allCandidates = fetched.flat();
  log.info('fetch.total', { total: allCandidates.length });

  // 2. Normalize
  const normalized = normalize(allCandidates, {
    now,
    windowHours: config.fetchWindowHours,
    bufferHours: config.fetchBufferHours,
  });

  // 3. Dedup against last N days. --rerun excludes the target date itself so
  // URLs / titles already published today can be re-picked when rewriting
  // today's issue with updated prompts.
  const deduped = await dedup(normalized, {
    rootDir,
    now,
    windowDays: config.dedupWindowDays,
    excludeDates: args.rerun ? [config.targetDate] : undefined,
  });

  // 4. Section select
  const selected = selectBySection(deduped, config.sectionTargets);

  // 5. Generate (dry-run skips Claude calls)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !config.dryRun) {
    throw new Error('ANTHROPIC_API_KEY is required (or run with --dry-run).');
  }
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  const articles: Article[] = [];
  for (const section of Object.keys(selected) as ArticleSection[]) {
    const pool = selected[section];
    if (config.dryRun || !client) {
      log.info('generate.section.dry-run', {
        section,
        candidates: pool.map((c) => ({
          title: c.title,
          source: c.source_name,
          group: c.source_group,
        })),
      });
      continue;
    }
    const sectionArticles = await generateSection({
      client,
      model: config.model,
      section,
      targets: config.sectionTargets[section],
      candidates: pool,
      date: config.targetDate,
    });
    articles.push(...sectionArticles);
  }

  // 6. Validate
  if (!config.dryRun) {
    validateArticles(articles);
    assertPublishable(articles);
  }

  // 7. Write
  const result = await writeIssue({
    rootDir,
    date: config.targetDate,
    generatedAt: now.toISOString(),
    articles,
    dryRun: config.dryRun,
  });

  log.info('pipeline.done', {
    date: config.targetDate,
    articles: articles.length,
    changed: result.changed,
    dryRun: config.dryRun,
  });
}

main().catch((err) => {
  log.error('pipeline.fatal', { err: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
