import { parse } from 'node-html-parser';
import type { Candidate } from '../types';
import { log } from '../log';

const UA = 'Mozilla/5.0 (ai-marketer-daily)';
const ARCHIVE_URL = 'https://www.therundown.ai/archive';
const MAX_POSTS = 5;

interface PostMeta {
  url: string;
  title: string;
  description: string;
  publishedAt: string;
}

async function fetchArchiveSlugs(): Promise<string[]> {
  const res = await fetch(ARCHIVE_URL, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`archive ${res.status}`);
  const html = await res.text();
  const seen = new Set<string>();
  const slugs: string[] = [];
  const rx = /"\/p\/([a-z0-9-]{8,})"/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
    if (slugs.length >= MAX_POSTS) break;
  }
  return slugs;
}

async function fetchPost(slug: string): Promise<PostMeta | null> {
  const url = `https://www.therundown.ai/p/${slug}`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) return null;
  const html = await res.text();
  const root = parse(html);
  const title =
    root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ??
    root.querySelector('title')?.text.trim() ??
    '';
  const description =
    root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ?? '';
  const datePublishedMatch = html.match(/"datePublished":"([^"]+)"/);
  const publishedAt = datePublishedMatch ? datePublishedMatch[1] : '';
  if (!title || !publishedAt) return null;
  return { url, title, description, publishedAt };
}

export async function fetchTheRundown(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  let slugs: string[] = [];
  try {
    slugs = await fetchArchiveSlugs();
  } catch (e) {
    log.warn('source.therundown.archive.error', { err: String(e) });
    return [];
  }
  const cutoff = opts.now.getTime() - opts.windowHours * 3600 * 1000;
  const posts = await Promise.all(slugs.map((s) => fetchPost(s).catch(() => null)));
  const out: Candidate[] = [];
  for (const p of posts) {
    if (!p) continue;
    const ts = Date.parse(p.publishedAt);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    out.push({
      source_group: 'brief_media',
      source_name: 'The Rundown AI',
      source_url: p.url,
      title: p.title,
      raw_text: p.description || null,
      published_at: new Date(ts).toISOString(),
      fetched_at: opts.now.toISOString(),
      lang: 'en',
      metrics: {},
      raw: { slug: p.url.split('/').pop() ?? '' },
    });
  }
  log.info('source.therundown.done', { scanned: slugs.length, candidates: out.length });
  return out;
}
