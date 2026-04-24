import fs from 'node:fs/promises';
import path from 'node:path';
import type { Candidate } from './types';
import type { Article } from '../../src/lib/types';
import { log } from './log';

interface IssueFile {
  date: string;
  generatedAt: string | null;
  articles: Article[];
}

function trigrams(s: string): Set<string> {
  const clean = s
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, ' ')
    .trim();
  const out = new Set<string>();
  for (let i = 0; i <= clean.length - 3; i += 1) {
    out.add(clean.slice(i, i + 3));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / (a.size + b.size - inter);
}

async function loadRecentArticles(opts: {
  rootDir: string;
  now: Date;
  windowDays: number;
  excludeDates?: string[];
}): Promise<Article[]> {
  const indexPath = path.join(opts.rootDir, 'src/data/index.json');
  let dates: string[];
  try {
    const body = JSON.parse(await fs.readFile(indexPath, 'utf-8')) as { dates: string[] };
    dates = body.dates;
  } catch {
    return [];
  }
  const cutoff = new Date(opts.now.getTime() - opts.windowDays * 24 * 3600 * 1000);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const exclude = new Set(opts.excludeDates ?? []);
  const recent = dates.filter((d) => d >= cutoffISO && !exclude.has(d));
  const articles: Article[] = [];
  for (const d of recent) {
    try {
      const issue = JSON.parse(
        await fs.readFile(path.join(opts.rootDir, 'src/data/issues', `${d}.json`), 'utf-8'),
      ) as IssueFile;
      articles.push(...issue.articles);
    } catch {
      // skip missing
    }
  }
  return articles;
}

function urlHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function titleStem(title: string, n: number): string {
  // Keep first N meaningful characters. Strip leading markers like "最前线｜"
  // that 36kr and peers prepend, so the stem reflects the actual subject.
  const cleaned = title
    .replace(/^[\[「【]*[^｜|\]」】]+[｜|\]」】]\s*/u, '')
    .trim();
  return cleaned.slice(0, n);
}

export async function dedup(
  candidates: Candidate[],
  opts: { rootDir: string; now: Date; windowDays: number; excludeDates?: string[] },
): Promise<Candidate[]> {
  const history = await loadRecentArticles(opts);
  const seenUrls = new Set(
    history.map((a) => (a.source_url ?? '').replace(/\/$/, '')),
  );
  const seenTitleGrams = history.map((a) => trigrams(a.title_en + ' ' + (a.title_zh ?? '')));

  const out: Candidate[] = [];
  const seenInBatch = new Set<string>();
  const batchGrams: Set<string>[] = [];
  // Host + title-stem dedup: same publisher running two pieces on the
  // same subject today (e.g. 36kr posting two "微盟 AI..." articles with
  // different angles). Trigram Jaccard misses these when the headlines
  // phrase different aspects of one company's news. Keep the item with
  // the later published_at; the older one loses.
  const seenHostStems = new Map<string, Candidate>();
  let hostStemDrops = 0;

  for (const c of candidates) {
    if (seenUrls.has(c.source_url)) continue;
    if (seenInBatch.has(c.source_url)) continue;
    const grams = trigrams(c.title);
    const tooClose =
      seenTitleGrams.some((g) => jaccard(g, grams) > 0.7) ||
      batchGrams.some((g) => jaccard(g, grams) > 0.7);
    if (tooClose) continue;

    const key = `${urlHost(c.source_url)}|${titleStem(c.title, 6)}`;
    const prior = seenHostStems.get(key);
    if (prior) {
      const priorTs = Date.parse(prior.published_at);
      const currentTs = Date.parse(c.published_at);
      if (currentTs <= priorTs) {
        // Older / equal: drop current.
        hostStemDrops += 1;
        continue;
      }
      // Newer: replace prior in out[] and swap the map entry.
      const idx = out.indexOf(prior);
      if (idx >= 0) out.splice(idx, 1);
      hostStemDrops += 1;
      // Fall through — add current below.
    }

    seenInBatch.add(c.source_url);
    batchGrams.push(grams);
    seenHostStems.set(key, c);
    out.push(c);
  }
  log.info('dedup.done', {
    in: candidates.length,
    out: out.length,
    history: history.length,
    host_stem_drops: hostStemDrops,
  });
  return out;
}
