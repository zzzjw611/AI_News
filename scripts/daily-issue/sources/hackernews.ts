import type { Candidate } from '../types';
import { log } from '../log';

const BASE = 'https://hacker-news.firebaseio.com/v0';

interface HNItem {
  id: number;
  type: 'story' | 'comment' | 'job' | 'poll';
  title?: string;
  url?: string;
  text?: string;
  by?: string;
  time: number;
  score?: number;
  descendants?: number;
}

async function fetchItem(id: number): Promise<HNItem | null> {
  const res = await fetch(`${BASE}/item/${id}.json`);
  if (!res.ok) return null;
  return (await res.json()) as HNItem;
}

async function fetchList(kind: 'topstories' | 'showstories', limit: number): Promise<number[]> {
  const res = await fetch(`${BASE}/${kind}.json`);
  if (!res.ok) throw new Error(`HN ${kind} list ${res.status}`);
  const ids = (await res.json()) as number[];
  return ids.slice(0, limit);
}

const AI_RX =
  /\b(ai|llm|gpt|claude|gemini|openai|anthropic|deepseek|mistral|llama|agent|rag|embedding|transformer|deep[\s-]?learning|neural|diffusion|stable[\s-]?diffusion|sora|veo|kling|pika|runway|copilot|cursor|perplexity|xai|grok|qwen|tongyi|doubao|kimi|minimax|zhipu|glm)\b/i;

export async function fetchHackerNews(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  const cutoff = Math.floor((opts.now.getTime() - opts.windowHours * 3600 * 1000) / 1000);
  const [topIds, showIds] = await Promise.all([
    fetchList('topstories', 80),
    fetchList('showstories', 60),
  ]);
  const ids = Array.from(new Set([...topIds, ...showIds]));
  const items = await Promise.all(ids.map((id) => fetchItem(id).catch(() => null)));
  const candidates: Candidate[] = [];
  for (const it of items) {
    if (!it || it.type !== 'story') continue;
    if (it.time < cutoff) continue;
    if (!it.title) continue;
    const isShow = showIds.includes(it.id) || /^show hn[:\s]/i.test(it.title);
    const haystack = `${it.title} ${it.text ?? ''}`;
    if (!AI_RX.test(haystack)) continue;
    candidates.push({
      source_group: isShow ? 'launch_show_hn' : 'brief_community',
      source_name: isShow ? 'Show HN' : 'Hacker News',
      source_url: it.url ?? `https://news.ycombinator.com/item?id=${it.id}`,
      title: it.title,
      raw_text: it.text ?? null,
      published_at: new Date(it.time * 1000).toISOString(),
      fetched_at: opts.now.toISOString(),
      lang: 'en',
      metrics: {
        hn_points: it.score,
        hn_comments: it.descendants,
      },
      raw: it as unknown as Record<string, unknown>,
    });
  }
  log.info('source.hackernews.done', { candidates: candidates.length });
  return candidates;
}
