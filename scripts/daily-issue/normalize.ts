import type { Candidate } from './types';
import { log } from './log';

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    // strip common tracking params
    const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'ref_src'];
    for (const k of drop) u.searchParams.delete(k);
    // reddit & hn canonical
    if (u.hostname.endsWith('reddit.com')) u.protocol = 'https:';
    return u.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
}

export function normalize(candidates: Candidate[], opts: {
  now: Date;
  windowHours: number;
}): Candidate[] {
  const cutoff = opts.now.getTime() - opts.windowHours * 3600 * 1000;
  const out: Candidate[] = [];
  for (const c of candidates) {
    if (!c.title.trim() || !c.source_url.trim()) continue;
    const ts = Date.parse(c.published_at);
    if (!Number.isFinite(ts)) continue;
    if (ts < cutoff) continue;
    out.push({
      ...c,
      title: c.title.trim().replace(/\s+/g, ' '),
      source_url: normalizeUrl(c.source_url),
      raw_text: c.raw_text ? c.raw_text.trim().slice(0, 4000) : null,
    });
  }
  log.info('normalize.done', { in: candidates.length, out: out.length });
  return out;
}
