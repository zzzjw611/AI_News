import fs from 'node:fs/promises';
import path from 'node:path';
import type { Candidate } from '../types';
import { log } from '../log';

/**
 * X (Twitter) API v2 read-only fetcher for Growth Insight whitelist.
 *
 * Free tier budget: 500 Posts reads/month. We cap at ~16 accounts × 1 call/day
 * ≈ 480/month. User IDs are cached in scripts/daily-issue/.x-user-ids.json
 * so we only resolve each username once (ever).
 *
 * Quality filter: min like threshold + min text length weeds out one-liners,
 * pure link shares, and reply fragments that slip past `exclude=replies`.
 */

interface XUser {
  id: string;
  name: string;
  username: string;
}

interface XTweet {
  id: string;
  text: string;
  created_at: string;
  lang?: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
}

interface UsersResponse {
  data?: XUser;
  errors?: Array<{ detail: string }>;
}
interface TweetsResponse {
  data?: XTweet[];
  meta?: { result_count: number };
  errors?: Array<{ detail: string }>;
}

/** Whitelist: curated from github.com/zarazhangrui/follow-builders (AI builders)
 * + growth/marketing practitioners. Total cap ~16 to stay within free-tier 500/mo. */
const WHITELIST: Array<{ username: string; tags: string[] }> = [
  // AI builders — opinion-heavy
  { username: 'karpathy', tags: ['ai-research'] },
  { username: 'swyx', tags: ['ai-devrel', 'latent-space'] },
  { username: 'AmandaAskell', tags: ['ai-alignment', 'anthropic'] },
  { username: 'alexalbert__', tags: ['anthropic'] },
  { username: 'rauchg', tags: ['vercel', 'dx'] },
  { username: 'amasad', tags: ['replit'] },
  { username: 'danshipper', tags: ['every', 'ai-workflow'] },
  { username: 'sama', tags: ['openai'] },
  // Market / distribution operators
  { username: 'mattturck', tags: ['vc', 'data-infra'] },
  { username: 'garrytan', tags: ['yc', 'startup'] },
  { username: 'levie', tags: ['enterprise', 'box'] },
  { username: 'packyM', tags: ['not-boring', 'strategy'] },
  // Growth / marketing practitioners
  { username: 'lennysan', tags: ['product', 'growth'] },
  { username: 'Julian', tags: ['growth'] },
  { username: 'nathanbarry', tags: ['kit', 'creator-economy'] },
  { username: 'harrydry', tags: ['marketing-examples'] },
];

const CACHE_PATH = path.join(process.cwd(), 'scripts/daily-issue/.x-user-ids.json');
const MIN_LIKES = 20;
const MIN_TEXT_LEN = 80;

interface UserIdCache {
  [username: string]: { id: string; name: string; resolved_at: string };
}

async function loadCache(): Promise<UserIdCache> {
  try {
    return JSON.parse(await fs.readFile(CACHE_PATH, 'utf-8')) as UserIdCache;
  } catch {
    return {};
  }
}

async function saveCache(cache: UserIdCache): Promise<void> {
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n');
}

async function xGet<T>(url: string, bearer: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  if (res.status === 429) {
    throw new Error(`rate-limited (reset=${res.headers.get('x-rate-limit-reset') ?? 'unknown'})`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`status ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

async function resolveUserId(username: string, bearer: string): Promise<XUser | null> {
  try {
    const body = await xGet<UsersResponse>(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`,
      bearer,
    );
    if (!body.data) {
      log.warn('source.x.resolve.error', { username, errors: body.errors });
      return null;
    }
    return body.data;
  } catch (e) {
    log.warn('source.x.resolve.error', { username, err: String(e) });
    return null;
  }
}

async function fetchRecentTweets(userId: string, bearer: string): Promise<XTweet[]> {
  const url =
    `https://api.twitter.com/2/users/${userId}/tweets?` +
    `max_results=20&exclude=retweets,replies&` +
    `tweet.fields=created_at,lang,public_metrics`;
  const body = await xGet<TweetsResponse>(url, bearer);
  return body.data ?? [];
}

export async function fetchXApi(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  const bearer = process.env.X_API_BEARER_TOKEN;
  if (!bearer) {
    log.warn('source.x.skip', { reason: 'X_API_BEARER_TOKEN not set' });
    return [];
  }
  const cutoff = opts.now.getTime() - opts.windowHours * 3600 * 1000;
  const cache = await loadCache();

  // Resolve missing user IDs (one call each, cached forever)
  let cacheDirty = false;
  for (const entry of WHITELIST) {
    if (cache[entry.username]) continue;
    const u = await resolveUserId(entry.username, bearer);
    if (!u) continue;
    cache[entry.username] = { id: u.id, name: u.name, resolved_at: new Date().toISOString() };
    cacheDirty = true;
  }
  if (cacheDirty) await saveCache(cache);

  const results: Candidate[] = [];
  for (const entry of WHITELIST) {
    const cached = cache[entry.username];
    if (!cached) continue;
    try {
      const tweets = await fetchRecentTweets(cached.id, bearer);
      for (const t of tweets) {
        const ts = Date.parse(t.created_at);
        if (!Number.isFinite(ts) || ts < cutoff) continue;
        if (t.public_metrics.like_count < MIN_LIKES) continue;
        const text = t.text.trim();
        if (text.length < MIN_TEXT_LEN) continue;
        // Strip trailing t.co media links for cleaner content
        const cleanText = text.replace(/\s*https:\/\/t\.co\/\S+/g, '').trim();
        results.push({
          source_group: 'growth_x_accounts',
          source_name: `@${entry.username}`,
          source_url: `https://x.com/${entry.username}/status/${t.id}`,
          title: cleanText.slice(0, 140),
          raw_text: cleanText,
          published_at: new Date(ts).toISOString(),
          fetched_at: opts.now.toISOString(),
          lang: t.lang === 'zh' ? 'zh' : 'en',
          metrics: {},
          raw: {
            author: cached.name,
            tags: entry.tags,
            likes: t.public_metrics.like_count,
            reposts: t.public_metrics.retweet_count,
            impressions: t.public_metrics.impression_count ?? 0,
          },
        });
      }
    } catch (e) {
      log.warn('source.x.user.error', { username: entry.username, err: String(e) });
    }
  }
  log.info('source.x.done', {
    users: WHITELIST.length,
    cached: Object.keys(cache).length,
    candidates: results.length,
  });
  return results;
}
