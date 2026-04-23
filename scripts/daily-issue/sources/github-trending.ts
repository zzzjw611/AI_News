import { parse } from 'node-html-parser';
import type { Candidate } from '../types';
import { log } from '../log';

const TRENDING_URL = 'https://github.com/trending?since=daily&spoken_language_code=';
const AI_TOPICS_URL = 'https://github.com/trending/python?since=daily';

function parseStars(text: string): number {
  const match = text.replace(/,/g, '').match(/([0-9]+)/);
  return match ? Number(match[1]) : 0;
}

async function scrape(url: string): Promise<Candidate[]> {
  const now = new Date();
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    },
  });
  if (!res.ok) {
    log.warn('source.github.fetch.error', { url, status: res.status });
    return [];
  }
  const html = await res.text();
  const root = parse(html);
  const items = root.querySelectorAll('article.Box-row');
  const candidates: Candidate[] = [];
  for (const item of items) {
    const link = item.querySelector('h2 a');
    if (!link) continue;
    const href = link.getAttribute('href') ?? '';
    const [, owner, repo] = href.split('/');
    if (!owner || !repo) continue;
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const desc = item.querySelector('p')?.text.trim() ?? '';
    const starsTodayEl = item.querySelector('span.d-inline-block.float-sm-right');
    const starsToday = starsTodayEl ? parseStars(starsTodayEl.text) : 0;
    const title = `${owner}/${repo}`;
    const haystack = `${title} ${desc}`;
    if (!/\b(ai|llm|gpt|claude|gemini|agent|rag|transformer|diffusion|llama|mistral|openai|anthropic|deepseek|qwen|neural|ml|model|inference|embedding|vector)\b/i.test(haystack)) {
      continue;
    }
    candidates.push({
      source_group: 'launch_github_trending',
      source_name: 'GitHub Trending',
      source_url: repoUrl,
      title,
      raw_text: desc || null,
      published_at: now.toISOString(),
      fetched_at: now.toISOString(),
      lang: 'en',
      metrics: {
        github_stars_today: starsToday,
      },
      raw: { owner, repo, description: desc },
    });
  }
  return candidates;
}

export async function fetchGithubTrending(): Promise<Candidate[]> {
  const [a, b] = await Promise.all([scrape(TRENDING_URL), scrape(AI_TOPICS_URL)]);
  const map = new Map<string, Candidate>();
  for (const c of [...a, ...b]) map.set(c.source_url, c);
  const out = [...map.values()];
  log.info('source.github.done', { candidates: out.length });
  return out;
}
