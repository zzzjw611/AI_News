import type { Candidate, SourceGroup } from './types';
import type { ArticleSection } from '../../src/lib/types';
import { log } from './log';

const FILL_ORDER: ArticleSection[] = [
  'launch_radar',
  'growth_insight',
  'daily_brief',
  'daily_case',
];

const SECTION_GROUPS: Record<ArticleSection, SourceGroup[]> = {
  daily_brief: [
    'brief_first_party',
    'brief_media',
    'brief_community',
    'brief_regulation',
    'brief_data',
  ],
  growth_insight: [
    'growth_x_accounts',
    'growth_linkedin_posts',
    'growth_substack',
    'growth_podcasts',
    'growth_cn_creators',
  ],
  launch_radar: [
    'launch_changelogs',
    'launch_producthunt',
    'launch_github_trending',
    'launch_show_hn',
    'launch_x_launches',
    // Fallback: lab / big-tech blogs often announce products here. LR is first
    // in FILL_ORDER so it claims the top heavyweight before DB gets a chance.
    // brief_media is intentionally excluded — media carries non-launch news too
    // (analysis, opinion, event promos), so it pollutes the LR pool.
    'brief_first_party',
  ],
  daily_case: [
    'case_hot_companies',
    'case_deep_media',
    'case_community_reaction',
    'case_data_evidence',
    'case_user_requests',
    'brief_first_party',
    'brief_media',
    'brief_community',
  ],
};

// Per-section mix constraints. Keys are source_group subsets; values are
// the max number of picks from that subset in this section. Pool-wide
// scoring still runs, but these caps trim community-heavy pools so DB
// reflects PRD's "≥ 4 companies / ≥ 3 event types" rather than N reddit hot takes.
type GroupSet = ReadonlySet<SourceGroup>;
const COMMUNITY: GroupSet = new Set<SourceGroup>(['brief_community', 'case_community_reaction']);
const FIRST_PARTY: GroupSet = new Set<SourceGroup>(['brief_first_party', 'launch_changelogs', 'case_hot_companies']);
const MEDIA: GroupSet = new Set<SourceGroup>(['brief_media', 'case_deep_media']);
// Launch Radar "heavyweight" = lab / big-tech announcing products.
// "Indie" = everything grass-roots (Show HN, GitHub Trending, PH, X launches).
const LR_HEAVY: GroupSet = new Set<SourceGroup>([
  'launch_changelogs',
  'brief_first_party',
]);
const LR_INDIE: GroupSet = new Set<SourceGroup>([
  'launch_github_trending',
  'launch_show_hn',
  'launch_producthunt',
  'launch_x_launches',
]);

interface MixRule {
  // cap on number of picks matching the subset
  maxFromCommunity?: number;
  // soft floor — will pad to this count if enough first-party/media exist
  minFromFirstPartyOrMedia?: number;
  // cap on picks sharing the same source_name
  maxPerSource?: number;
  // require ≥ 1 pick from LR_HEAVY and ≥ 1 from LR_INDIE when max ≥ 2
  requireHeavyIndieMix?: boolean;
}

const SECTION_MIX: Record<ArticleSection, MixRule> = {
  daily_brief: { maxFromCommunity: 2, minFromFirstPartyOrMedia: 3, maxPerSource: 2 },
  growth_insight: { maxPerSource: 1 },
  launch_radar: { maxPerSource: 1, requireHeavyIndieMix: true },
  daily_case: { maxFromCommunity: 1, maxPerSource: 1 },
};

/**
 * Group-level weights decide the spine of the ordering. Engagement metrics
 * (HN points, Reddit score, stars) supply a tiebreaker, not the headline.
 */
function baseScore(c: Candidate): number {
  if (FIRST_PARTY.has(c.source_group)) return 220;
  if (MEDIA.has(c.source_group)) return 170;
  if (c.source_group.startsWith('launch_')) return 160;
  // Growth Insight values thesis density. Long-form (Substack, podcasts) >
  // short X takes — the latter are often product promo from founders and get
  // weeded out either here or at generation time.
  if (c.source_group === 'growth_substack') return 180;
  if (c.source_group === 'growth_podcasts') return 155;
  if (c.source_group === 'growth_linkedin_posts') return 140;
  if (c.source_group === 'growth_cn_creators') return 140;
  if (c.source_group === 'growth_x_accounts') return 120;
  if (c.source_group === 'case_data_evidence') return 140;
  if (c.source_group === 'case_user_requests') return 130;
  if (COMMUNITY.has(c.source_group)) return 80;
  return 100;
}

function score(c: Candidate): number {
  let s = baseScore(c);
  // log-dampened engagement so a 2000-upvote meme doesn't outrank OpenAI's blog
  s += Math.min(40, Math.log10(1 + (c.metrics.hn_points ?? 0)) * 15);
  s += Math.min(25, Math.log10(1 + (c.metrics.hn_comments ?? 0)) * 10);
  s += Math.min(40, Math.log10(1 + (c.metrics.reddit_score ?? 0)) * 15);
  s += Math.min(25, Math.log10(1 + (c.metrics.reddit_comments ?? 0)) * 10);
  s += Math.min(50, Math.log10(1 + (c.metrics.github_stars_today ?? 0)) * 20);
  // recency: up to +20 for freshest, 0 for 24h old
  const ageHours = Math.max(0, (Date.now() - Date.parse(c.published_at)) / 3600000);
  s += Math.max(0, 20 - ageHours * 0.8);
  return s;
}

interface PickState {
  picked: Candidate[];
  perSource: Map<string, number>;
  communityCount: number;
  firstPartyOrMediaCount: number;
  heavyCount: number;
  indieCount: number;
}

function wouldViolate(c: Candidate, state: PickState, rule: MixRule): boolean {
  if (rule.maxPerSource && (state.perSource.get(c.source_name) ?? 0) >= rule.maxPerSource) return true;
  if (rule.maxFromCommunity !== undefined && COMMUNITY.has(c.source_group) && state.communityCount >= rule.maxFromCommunity) return true;
  return false;
}

function isFirstPartyOrMedia(c: Candidate): boolean {
  return FIRST_PARTY.has(c.source_group) || MEDIA.has(c.source_group);
}

export function selectBySection(
  candidates: Candidate[],
  targets: Record<ArticleSection, { min: number; max: number }>,
): Record<ArticleSection, Candidate[]> {
  const sorted = [...candidates].sort((a, b) => score(b) - score(a));
  const claimed = new Set<Candidate>();
  const chosen: Record<ArticleSection, Candidate[]> = {
    daily_brief: [],
    growth_insight: [],
    launch_radar: [],
    daily_case: [],
  };

  for (const section of FILL_ORDER) {
    const groups = new Set(SECTION_GROUPS[section]);
    const rule = SECTION_MIX[section];
    const eligible = sorted.filter((c) => !claimed.has(c) && groups.has(c.source_group));
    const state: PickState = {
      picked: [],
      perSource: new Map(),
      communityCount: 0,
      firstPartyOrMediaCount: 0,
      heavyCount: 0,
      indieCount: 0,
    };

    const pick = (c: Candidate) => {
      state.picked.push(c);
      state.perSource.set(c.source_name, (state.perSource.get(c.source_name) ?? 0) + 1);
      if (COMMUNITY.has(c.source_group)) state.communityCount += 1;
      if (isFirstPartyOrMedia(c)) state.firstPartyOrMediaCount += 1;
      if (LR_HEAVY.has(c.source_group)) state.heavyCount += 1;
      if (LR_INDIE.has(c.source_group)) state.indieCount += 1;
      claimed.add(c);
    };

    // Pass 1: honor minFromFirstPartyOrMedia — grab top first-party/media first
    if (rule.minFromFirstPartyOrMedia) {
      for (const c of eligible) {
        if (state.picked.length >= targets[section].max) break;
        if (state.firstPartyOrMediaCount >= rule.minFromFirstPartyOrMedia) break;
        if (!isFirstPartyOrMedia(c)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule)) continue;
        pick(c);
      }
    }

    // Pass 1b: Launch Radar heavy/indie mix — reserve 1 slot for each bucket
    if (rule.requireHeavyIndieMix && targets[section].max >= 2) {
      for (const c of eligible) {
        if (state.heavyCount >= 1) break;
        if (!LR_HEAVY.has(c.source_group)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule)) continue;
        pick(c);
      }
      for (const c of eligible) {
        if (state.indieCount >= 1) break;
        if (!LR_INDIE.has(c.source_group)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule)) continue;
        pick(c);
      }
    }

    // Pass 2: fill remaining slots by score with mix-rule enforcement
    for (const c of eligible) {
      if (state.picked.length >= targets[section].max) break;
      if (claimed.has(c)) continue;
      if (wouldViolate(c, state, rule)) continue;
      pick(c);
    }

    // Pass 3: if still under min, relax community cap (never drop below min)
    if (state.picked.length < targets[section].min) {
      for (const c of eligible) {
        if (state.picked.length >= targets[section].min) break;
        if (claimed.has(c)) continue;
        if (rule.maxPerSource && (state.perSource.get(c.source_name) ?? 0) >= rule.maxPerSource) continue;
        pick(c);
      }
    }

    chosen[section] = state.picked;
    log.info('section-select.picked', {
      section,
      eligible: eligible.length,
      picked: state.picked.length,
      community: state.communityCount,
      first_party_or_media: state.firstPartyOrMediaCount,
      target: targets[section],
      picks: state.picked.map((c) => ({
        source_group: c.source_group,
        source_name: c.source_name,
        title: c.title.slice(0, 120),
      })),
    });
  }
  return chosen;
}
