import type { Candidate } from '../types';
import { log } from '../log';

const SUBS = ['LocalLLaMA', 'ChatGPT', 'ClaudeAI'];

interface RedditListing {
  data: {
    children: Array<{
      data: {
        id: string;
        title: string;
        selftext: string;
        url: string;
        permalink: string;
        author: string;
        created_utc: number;
        score: number;
        num_comments: number;
        over_18: boolean;
        stickied: boolean;
      };
    }>;
  };
}

export async function fetchReddit(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  const cutoff = (opts.now.getTime() - opts.windowHours * 3600 * 1000) / 1000;
  const results: Candidate[] = [];
  for (const sub of SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=30`, {
        headers: { 'user-agent': 'ai-marketer-daily/1.0 (+github)' },
      });
      if (!res.ok) {
        log.warn('source.reddit.sub.error', { sub, status: res.status });
        continue;
      }
      const body = (await res.json()) as RedditListing;
      for (const { data: p } of body.data.children) {
        if (p.over_18 || p.stickied) continue;
        if (p.created_utc < cutoff) continue;
        const permalink = `https://www.reddit.com${p.permalink}`;
        results.push({
          source_group: 'brief_community',
          source_name: `r/${sub}`,
          source_url: p.url && !p.url.startsWith('/r/') ? p.url : permalink,
          title: p.title,
          raw_text: p.selftext || null,
          published_at: new Date(p.created_utc * 1000).toISOString(),
          fetched_at: opts.now.toISOString(),
          lang: 'en',
          metrics: {
            reddit_score: p.score,
            reddit_comments: p.num_comments,
          },
          raw: { id: p.id, permalink, author: p.author },
        });
      }
    } catch (e) {
      log.warn('source.reddit.sub.error', { sub, err: String(e) });
    }
  }
  log.info('source.reddit.done', { candidates: results.length });
  return results;
}
