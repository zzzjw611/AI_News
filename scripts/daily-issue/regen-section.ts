import process from 'node:process';
import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { Article, ArticleSection } from '../../src/lib/types';
import type { Candidate } from './types';
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
import { validateArticles } from './validate';
import { writeIssue } from './write';
import { log } from './log';

const VALID_SECTIONS: ArticleSection[] = [
  'daily_brief',
  'growth_insight',
  'launch_radar',
  'daily_case',
];

const SECTION_ORDER: ArticleSection[] = [
  'daily_brief',
  'growth_insight',
  'launch_radar',
  'daily_case',
];

const DEFAULT_TARGETS: Record<ArticleSection, { min: number; max: number }> = {
  daily_brief: { min: 6, max: 6 },
  growth_insight: { min: 0, max: 2 },
  launch_radar: { min: 1, max: 2 },
  daily_case: { min: 1, max: 1 },
};

interface IssueFile {
  date: string;
  generatedAt: string | null;
  articles: Article[];
}

function parseArgs(argv: string[]): {
  date: string;
  section: ArticleSection;
  dryRun: boolean;
  forceSourceUrl?: string;
} {
  let date: string | undefined;
  let section: string | undefined;
  let dryRun = false;
  let forceSourceUrl: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--date') date = argv[i + 1];
    else if (a === '--section') section = argv[i + 1];
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--force-source-url') forceSourceUrl = argv[i + 1];
  }
  if (!date) throw new Error('--date YYYY-MM-DD is required');
  if (!section) throw new Error('--section <daily_brief|growth_insight|launch_radar|daily_case> is required');
  if (!VALID_SECTIONS.includes(section as ArticleSection)) {
    throw new Error(`invalid section: ${section}`);
  }
  return { date, section: section as ArticleSection, dryRun, forceSourceUrl };
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

async function main(): Promise<void> {
  const { date, section, dryRun, forceSourceUrl } = parseArgs(process.argv.slice(2));
  const now = new Date();
  const rootDir = process.cwd();
  log.info('regen.start', { date, section, dryRun, forceSourceUrl: forceSourceUrl ?? null });

  const issuePath = path.join(rootDir, 'src/data/issues', `${date}.json`);
  let existing: IssueFile;
  try {
    existing = JSON.parse(await fs.readFile(issuePath, 'utf-8')) as IssueFile;
  } catch (e) {
    throw new Error(`Cannot read existing issue ${issuePath}: ${String(e)}`);
  }
  const preserved = existing.articles.filter((a) => a.section !== section);
  const droppedCount = existing.articles.length - preserved.length;
  log.info('regen.preserved', {
    section,
    preserved: preserved.length,
    dropping: droppedCount,
  });

  // Match the main pipeline: fetchers look back 25h, normalize trims to [now-25h, now-1h].
  const fetchOpts = { windowHours: 25, now };
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

  const normalized = normalize(allCandidates, { now, windowHours: 24, bufferHours: 1 });

  let pool: Candidate[];
  let genTargets: { min: number; max: number };

  if (forceSourceUrl) {
    const wanted = stripTrailingSlash(forceSourceUrl);
    const match = normalized.find((c) => stripTrailingSlash(c.source_url) === wanted);
    if (!match) {
      log.error('regen.force.url.not-found', {
        forceSourceUrl,
        normalized_urls_sample: normalized.slice(0, 10).map((c) => c.source_url),
      });
      throw new Error(
        `Forced URL not in fetched/normalized pool: ${forceSourceUrl} — ` +
          `either the source feed didn't surface it, or the URL was tracking-param-stripped into a different form.`,
      );
    }
    log.info('regen.force.url.matched', {
      source_name: match.source_name,
      source_group: match.source_group,
      title: match.title,
    });
    pool = [match];
    // With a single forced candidate, lock the target to exactly 1 card.
    genTargets = { min: 1, max: 1 };
  } else {
    // Exclude the target date from dedup history so candidates already used in
    // today's issue (which we are about to replace for this section) can be
    // re-picked. Without this, the LLM would be forced to pick a fresh case.
    const deduped = await dedup(normalized, {
      rootDir,
      now,
      windowDays: 7,
      excludeDates: [date],
    });
    // Zero out other sections so selectBySection's round-robin doesn't claim
    // candidates away from the one section we care about.
    const targets: Record<ArticleSection, { min: number; max: number }> = {
      daily_brief: { min: 0, max: 0 },
      growth_insight: { min: 0, max: 0 },
      launch_radar: { min: 0, max: 0 },
      daily_case: { min: 0, max: 0 },
    };
    targets[section] = DEFAULT_TARGETS[section];
    const selected = selectBySection(deduped, targets);
    pool = selected[section];
    genTargets = DEFAULT_TARGETS[section];
    if (pool.length === 0) {
      throw new Error(`No candidates selected for section ${section} — aborting.`);
    }
  }

  if (dryRun) {
    log.info('regen.dry-run.pool', {
      section,
      candidates: pool.map((c) => ({
        title: c.title,
        source: c.source_name,
        group: c.source_group,
        url: c.source_url,
      })),
    });
    log.info('regen.dry-run.done', { date, section });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  const client = new Anthropic({ apiKey });

  const newArticles = await generateSection({
    client,
    model: 'claude-sonnet-4-6',
    section,
    targets: genTargets,
    candidates: pool,
    date,
  });
  validateArticles(newArticles);

  const merged = [...preserved, ...newArticles];
  merged.sort((a, b) => {
    const sa = SECTION_ORDER.indexOf(a.section);
    const sb = SECTION_ORDER.indexOf(b.section);
    if (sa !== sb) return sa - sb;
    return a.order_in_section - b.order_in_section;
  });

  const result = await writeIssue({
    rootDir,
    date,
    generatedAt: now.toISOString(),
    articles: merged,
    dryRun: false,
  });

  log.info('regen.done', {
    date,
    section,
    preserved: preserved.length,
    regenerated: newArticles.length,
    total: merged.length,
    changed: result.changed,
  });
}

main().catch((err) => {
  log.error('regen.fatal', { err: err instanceof Error ? err.message : String(err) });
  process.exitCode = 1;
});
