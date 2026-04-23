import fs from 'node:fs/promises';
import path from 'node:path';
import type { Article } from '../../src/lib/types';
import { log } from './log';

interface IssuePayload {
  date: string;
  generatedAt: string;
  articles: Article[];
}

interface IndexFile {
  dates: string[];
}

function stringifyIssue(payload: IssuePayload): string {
  return JSON.stringify(payload, null, 2) + '\n';
}

export async function writeIssue(opts: {
  rootDir: string;
  date: string;
  generatedAt: string;
  articles: Article[];
  dryRun: boolean;
}): Promise<{ changed: boolean; paths: string[] }> {
  const payload: IssuePayload = {
    date: opts.date,
    generatedAt: opts.generatedAt,
    articles: opts.articles,
  };
  const issuePath = path.join(opts.rootDir, 'src/data/issues', `${opts.date}.json`);
  const latestPath = path.join(opts.rootDir, 'src/data/latest.json');
  const indexPath = path.join(opts.rootDir, 'src/data/index.json');

  const existingIndex: IndexFile = await fs
    .readFile(indexPath, 'utf-8')
    .then((raw) => JSON.parse(raw) as IndexFile)
    .catch(() => ({ dates: [] }));
  const mergedDates = Array.from(new Set([opts.date, ...existingIndex.dates])).sort().reverse();
  const newIndex: IndexFile = { dates: mergedDates };

  const issueBody = stringifyIssue(payload);
  const latestBody = mergedDates[0] === opts.date ? issueBody : null;
  const indexBody = JSON.stringify(newIndex, null, 2) + '\n';

  const writes: Array<{ path: string; body: string }> = [
    { path: issuePath, body: issueBody },
    { path: indexPath, body: indexBody },
  ];
  if (latestBody) writes.push({ path: latestPath, body: latestBody });

  const changed: string[] = [];
  for (const w of writes) {
    let current: string | null = null;
    try {
      current = await fs.readFile(w.path, 'utf-8');
    } catch {
      current = null;
    }
    if (current === w.body) continue;
    if (!opts.dryRun) {
      await fs.mkdir(path.dirname(w.path), { recursive: true });
      await fs.writeFile(w.path, w.body);
    }
    changed.push(w.path);
  }
  log.info('write.done', {
    changed: changed.length,
    paths: changed.map((p) => path.relative(opts.rootDir, p)),
    dryRun: opts.dryRun,
  });
  return { changed: changed.length > 0, paths: changed };
}
