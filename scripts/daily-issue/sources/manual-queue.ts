import fs from 'node:fs/promises';
import path from 'node:path';
import type { Candidate, SourceGroup } from '../types';
import { log } from '../log';

interface ManualItem {
  source_group: SourceGroup;
  source_name: string;
  source_url: string;
  title: string;
  raw_text?: string;
  published_at: string;
  lang?: 'en' | 'zh';
  /** Optional: delete from the queue after this many days (default 3). */
  expires_in_days?: number;
}

interface ManualQueueFile {
  items: ManualItem[];
}

export async function fetchManualQueue(opts: {
  rootDir: string;
  now: Date;
}): Promise<Candidate[]> {
  const file = path.join(opts.rootDir, 'src/data/manual-queue.json');
  let raw: ManualQueueFile;
  try {
    raw = JSON.parse(await fs.readFile(file, 'utf-8')) as ManualQueueFile;
  } catch (e) {
    log.warn('source.manual.read.error', { err: String(e) });
    return [];
  }
  const candidates: Candidate[] = raw.items.map((it) => ({
    source_group: it.source_group,
    source_name: it.source_name,
    source_url: it.source_url,
    title: it.title,
    raw_text: it.raw_text ?? null,
    published_at: it.published_at,
    fetched_at: opts.now.toISOString(),
    lang: it.lang ?? 'unknown',
    metrics: {},
    raw: it as unknown as Record<string, unknown>,
  }));
  log.info('source.manual.done', { candidates: candidates.length });
  return candidates;
}
