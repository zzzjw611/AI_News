import type { Candidate, SourceGroup } from './types';
import type { ArticleSection } from '../../src/lib/types';
import { detectCompany, detectEventType } from './diversity';
import { log } from './log';

const FILL_ORDER: ArticleSection[] = [
  // daily_case runs first so it can claim the best marketer-focused
  // candidate before daily_brief (which has min 6 and tends to absorb
  // everything). Launch / growth use narrow source groups anyway, so
  // moving them later doesn't cost them candidates.
  'daily_case',
  'launch_radar',
  'growth_insight',
  'daily_brief',
];

const SECTION_GROUPS: Record<ArticleSection, SourceGroup[]> = {
  daily_brief: [
    'brief_first_party',
    'brief_marketer',
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
    'brief_marketer',
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
const MEDIA: GroupSet = new Set<SourceGroup>(['brief_media', 'brief_marketer', 'case_deep_media']);
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
  // Diversity caps (computed against the section's `max` slot count):
  //   maxPerCompanyRatio: 0.25 + max=6 → floor(1.5) = 1 per company
  // Candidates whose company can't be detected pass the cap freely —
  // they're treated as "unknown / neutral" and don't count against any
  // company bucket.
  maxPerCompanyRatio?: number;
  // Same idea for event type (launch / funding / security / ...).
  maxPerTypeRatio?: number;
  // Hard floor: issue must cover at least this many distinct detected
  // companies / types. Enforced via a runway-aware preference in Pass 2:
  // when remaining slots == remaining mins, only candidates carrying a
  // novel company / type are considered.
  minDistinctCompanies?: number;
  minDistinctTypes?: number;
}

const SECTION_MIX: Record<ArticleSection, MixRule> = {
  daily_brief: {
    maxFromCommunity: 2,
    minFromFirstPartyOrMedia: 3,
    maxPerSource: 2,
    maxPerCompanyRatio: 0.25,
    maxPerTypeRatio: 0.40,
    minDistinctCompanies: 4,
    minDistinctTypes: 3,
  },
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
  // Marketer-focused AI media (Digiday / Adweek / Marketing AI Institute / Marketing Brew / Marketing Dive)
  // rank above general media — AI × marketing intersection is a first-class
  // priority for this brief, and these sources already pre-filter for
  // marketing relevance.
  if (c.source_group === 'brief_marketer') return 200;
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
  // Manually-curated items beat everything else in their eligible section.
  // Use this for hand-picked AI × marketing case URLs you want to publish
  // regardless of what the RSS crawlers surface. Format: src/data/manual-queue.json.
  if (c.source_group === 'case_user_requests') return 260;
  if (COMMUNITY.has(c.source_group)) return 80;
  return 100;
}

// Marketing × AI bias. Push candidates that live at the intersection of
// AI and marketing / growth / distribution above pure-technical AI news.
// Matches title + raw_text; substring for ZH (no word-boundary notion),
// word-boundary-ish for EN. First hit +35, each extra unique hit +8, cap +60.
const EN_MARKETING_RE =
  /\b(marketing|advertising|advertis(ing|ement)|ads?|campaign|branding|brand (voice|guideline|safety|play|deal)|copywriting|copy(text)?|landing page|hero section|cta|ctr|cpc|cpm|cpa|cpl|roas|aov|ltv|cac|dau|mau|growth (loop|hack|marketer)|conversion|retention|funnel|seo|sem|geo|aeo|content marketing|newsletter|influencer|creator economy|creator partner|kol|go-to-market|gtm|icp|positioning|ad spend|paid ads|paid social|attribution|distribution|ugc|mcn|crm|lifecycle)\b/i;
const ZH_MARKETING_TOKENS = [
  '营销', '广告', '推广', '品牌力', '品牌定位', '品牌叙事', '投放', '增长', '转化',
  '分发', '内容营销', '种草', '电商', '社媒', '私域', '公域', '裂变', 'KOL', 'MCN',
  '获客', '拉新', '留存', '复购', '用户增长', '社群', '直播带货', '内容创作者',
];

function marketingBoost(c: Candidate): number {
  // Title is far more reliable than raw_text for aggregated sources
  // (a 36kr "8点1氪" digest mentions "广告" in passing but is not a
  // marketing story). Weight title hits 2×, body hits 1×.
  let titleHits = 0;
  if (EN_MARKETING_RE.test(c.title)) titleHits += 1;
  for (const tok of ZH_MARKETING_TOKENS) {
    if (c.title.includes(tok)) { titleHits += 1; break; }
  }
  let bodyHits = 0;
  if (c.raw_text) {
    if (EN_MARKETING_RE.test(c.raw_text)) bodyHits += 1;
    for (const tok of ZH_MARKETING_TOKENS) {
      if (c.raw_text.includes(tok)) { bodyHits += 1; break; }
    }
  }
  const effective = titleHits * 2 + bodyHits;
  if (effective === 0) return 0;
  return Math.min(60, 20 + effective * 12);
}

// Aggregated-news-digest penalty. Titles like "8点1氪 丨 华谊兄弟... 普华永道...
// 伊朗..." pack multiple unrelated stories into one feed item, so they
// trigger marketing / company / type detectors incorrectly and contribute
// no cohesive card. Big negative score so they drop out of top picks.
const ROUNDUP_RE =
  /(8\s*点\s*1\s*氪|晚报|早报|今日精选|头条早报|今日头条|快讯[丨|｜:：]|周报[:：]|日报[:：]|daily digest|weekly (digest|roundup)|news roundup|morning briefing|evening briefing)/i;

function roundupPenalty(c: Candidate): number {
  return ROUNDUP_RE.test(c.title) ? -120 : 0;
}

// Broader marketer-relevance signal than marketingBoost keywords —
// covers anything a marketer would plausibly action on. Used only for
// the "non-marketer AI" penalty, not for scoring boosts.
const MARKETER_CTX_RE =
  /\b(marketing|advertising|advertis(ing|ement)|ads?|campaign|branding|brand[\s-]|copy(text|writing)?|creative|landing page|hero section|cta|ctr|cpc|cpm|cpa|cpl|roas|aov|ltv|cac|dau|mau|growth|conversion|retention|funnel|seo|sem|geo|aeo|content marketing|newsletter|influencer|creator|kol|go-to-market|gtm|icp|positioning|attribution|distribution|paid (ads|social|search|media)|media buy|ad (platform|tech|format|spend|portfolio)|martech|crm|cdp|ecommerce|shopify|hubspot|klaviyo|salesforce|canva|meta ads?|google ads?|facebook ads?|adweek|digiday|marketing brew|adexchanger|mediapost|marketing dive|marketo|lead gen|pr |press release)\b|营销|广告|推广|品牌[^名字]|投放|增长|转化|分发|内容营销|种草|社媒|私域|公域|裂变|获客|留存|KOL|MCN|CRM|CDP|电商|直播带货|创作者|文案|创意|落地页|漏斗|广告主|品牌方|小红书|抖音|微信|公众号|DSP|SSP/i;

// Lab / major-vendor event: launches / funding / M&A / integrations
// that shift a marketer's vendor stack whether or not the post itself
// uses marketing wording.
const EVENT_RE =
  /\b(launches?|launched|releases?|released|ships?|shipping|announces?|announced|unveil(ed|s)?|introduces?|introduced|rollout|rolls out|raises? \$|raised \$|series [a-e]|funding round|valuation|valued at|acquires?|acquired|acquisition|integrates?|integration|pricing|partnership|ipo)\b|发布|推出|上线|融资|估值|收购|合作|并购/i;

// Non-marketer-AI penalty. A candidate is AI (passed AI_RX at fetch) but
// carries no marketer-context keyword AND is not a major lab event →
// -100. Applied globally; brief_marketer sources and lab-event items are
// exempt. Keeps pure-tech research, geopolitics, layoff news from
// dominating daily_brief while still allowing them in the pool as
// fallback if nothing better surfaces.
function nonMarketerPenalty(c: Candidate): number {
  if (c.source_group === 'brief_marketer') return 0;
  const hay = `${c.title} ${c.raw_text ?? ''}`;
  if (MARKETER_CTX_RE.test(hay)) return 0;
  // Lab event escape hatch: only brief_first_party stories (OpenAI blog /
  // Google Research / Hugging Face / etc.) get a pass on event wording.
  // brief_media reports of events (lawsuits, geopolitics, funding) still
  // eat the full penalty — those usually aren't marketer-actionable.
  if (c.source_group === 'brief_first_party' && EVENT_RE.test(hay)) return 0;
  return -100;
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
  // AI × marketing intersection bias: +20 to +60 when the candidate
  // mentions marketing / growth / brand / distribution concepts in the
  // title. Title hits weighted 2× vs body hits to avoid false positives
  // from aggregated feeds.
  s += marketingBoost(c);
  // Aggregated-digest titles get punished into irrelevance.
  s += roundupPenalty(c);
  // Pure-tech AI with no marketer angle and no lab-event framing gets
  // pushed to the bottom of the pool.
  s += nonMarketerPenalty(c);
  return s;
}

interface PickState {
  picked: Candidate[];
  perSource: Map<string, number>;
  communityCount: number;
  firstPartyOrMediaCount: number;
  heavyCount: number;
  indieCount: number;
  perCompany: Map<string, number>;
  perType: Map<string, number>;
  distinctCompanies: Set<string>;
  distinctTypes: Set<string>;
}

function capFromRatio(ratio: number, slots: number): number {
  // floor so the emitted count genuinely does not exceed the declared %
  // (e.g. ratio 0.25 × 6 slots → cap 1, not 2). Minimum of 1 so a
  // ratio of 0.1 on a 5-slot section doesn't collapse to zero.
  return Math.max(1, Math.floor(ratio * slots));
}

function wouldViolate(
  c: Candidate,
  state: PickState,
  rule: MixRule,
  max: number,
): boolean {
  if (rule.maxPerSource && (state.perSource.get(c.source_name) ?? 0) >= rule.maxPerSource) return true;
  if (rule.maxFromCommunity !== undefined && COMMUNITY.has(c.source_group) && state.communityCount >= rule.maxFromCommunity) return true;
  if (rule.maxPerCompanyRatio) {
    const company = detectCompany(c);
    if (company) {
      const cap = capFromRatio(rule.maxPerCompanyRatio, max);
      if ((state.perCompany.get(company) ?? 0) >= cap) return true;
    }
  }
  if (rule.maxPerTypeRatio) {
    const type = detectEventType(c);
    if (type) {
      const cap = capFromRatio(rule.maxPerTypeRatio, max);
      if ((state.perType.get(type) ?? 0) >= cap) return true;
    }
  }
  return false;
}

function isFirstPartyOrMedia(c: Candidate): boolean {
  return FIRST_PARTY.has(c.source_group) || MEDIA.has(c.source_group);
}

// Section-specific score adjustment, applied on top of the global score()
// during per-section pool re-sort. Use this to nudge selection toward
// section-appropriate sources without polluting the global ordering.
function sectionBonus(c: Candidate, section: ArticleSection): number {
  if (section === 'daily_case') {
    // Prefer sources with dedicated marketing-case orientation.
    if (c.source_group === 'brief_marketer') return 100;
    // brief_first_party (lab blogs) are usually not case-worthy —
    // they're product announcements, not teardowns. De-prioritize.
    if (c.source_group === 'brief_first_party') return -30;
  }
  return 0;
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
    const max = targets[section].max;
    const eligible = sorted.filter((c) => !claimed.has(c) && groups.has(c.source_group));
    const state: PickState = {
      picked: [],
      perSource: new Map(),
      communityCount: 0,
      firstPartyOrMediaCount: 0,
      heavyCount: 0,
      indieCount: 0,
      perCompany: new Map(),
      perType: new Map(),
      distinctCompanies: new Set(),
      distinctTypes: new Set(),
    };

    const pick = (c: Candidate) => {
      state.picked.push(c);
      state.perSource.set(c.source_name, (state.perSource.get(c.source_name) ?? 0) + 1);
      if (COMMUNITY.has(c.source_group)) state.communityCount += 1;
      if (isFirstPartyOrMedia(c)) state.firstPartyOrMediaCount += 1;
      if (LR_HEAVY.has(c.source_group)) state.heavyCount += 1;
      if (LR_INDIE.has(c.source_group)) state.indieCount += 1;
      const company = detectCompany(c);
      if (company) {
        state.perCompany.set(company, (state.perCompany.get(company) ?? 0) + 1);
        state.distinctCompanies.add(company);
      }
      const type = detectEventType(c);
      if (type) {
        state.perType.set(type, (state.perType.get(type) ?? 0) + 1);
        state.distinctTypes.add(type);
      }
      claimed.add(c);
    };

    // Pass 1: honor minFromFirstPartyOrMedia — grab top first-party/media first
    if (rule.minFromFirstPartyOrMedia) {
      for (const c of eligible) {
        if (state.picked.length >= max) break;
        if (state.firstPartyOrMediaCount >= rule.minFromFirstPartyOrMedia) break;
        if (!isFirstPartyOrMedia(c)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule, max)) continue;
        pick(c);
      }
    }

    // Pass 1b: Launch Radar heavy/indie mix — reserve 1 slot for each bucket
    if (rule.requireHeavyIndieMix && max >= 2) {
      for (const c of eligible) {
        if (state.heavyCount >= 1) break;
        if (!LR_HEAVY.has(c.source_group)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule, max)) continue;
        pick(c);
      }
      for (const c of eligible) {
        if (state.indieCount >= 1) break;
        if (!LR_INDIE.has(c.source_group)) continue;
        if (claimed.has(c)) continue;
        if (wouldViolate(c, state, rule, max)) continue;
        pick(c);
      }
    }

    // Pass 2: fill remaining slots with runway-aware diversity preference.
    // When the slots left equal the min-distinct deficit (or less), restrict
    // the pool to candidates carrying a novel company / type so we are
    // guaranteed to hit the mins by the last pick. Otherwise take the top
    // available candidate that doesn't violate any cap.
    while (state.picked.length < max) {
      const slotsLeft = max - state.picked.length;
      const companyDeficit = Math.max(0, (rule.minDistinctCompanies ?? 0) - state.distinctCompanies.size);
      const typeDeficit = Math.max(0, (rule.minDistinctTypes ?? 0) - state.distinctTypes.size);

      let pool = eligible.filter((c) => !claimed.has(c) && !wouldViolate(c, state, rule, max));
      if (pool.length === 0) break;

      if (companyDeficit >= slotsLeft) {
        const novel = pool.filter((c) => {
          const co = detectCompany(c);
          return !co || !state.distinctCompanies.has(co);
        });
        if (novel.length) pool = novel;
      }
      if (typeDeficit >= slotsLeft) {
        const novel = pool.filter((c) => {
          const t = detectEventType(c);
          return !t || !state.distinctTypes.has(t);
        });
        if (novel.length) pool = novel;
      }
      // Re-sort pool applying section-specific bonus so e.g. daily_case
      // prefers brief_marketer over a lab blog. The base score() order is
      // preserved for ties.
      pool.sort((a, b) => score(b) + sectionBonus(b, section) - score(a) - sectionBonus(a, section));
      pick(pool[0]);
    }

    // Pass 3: if still under min, relax community + diversity caps
    // (never drop below min — this only triggers when the eligible pool
    // is genuinely too thin, e.g. a quiet day with few first-party posts).
    if (state.picked.length < targets[section].min) {
      let relaxed = 0;
      for (const c of eligible) {
        if (state.picked.length >= targets[section].min) break;
        if (claimed.has(c)) continue;
        if (rule.maxPerSource && (state.perSource.get(c.source_name) ?? 0) >= rule.maxPerSource) continue;
        pick(c);
        relaxed += 1;
      }
      if (relaxed > 0) log.warn('section-select.relaxed', { section, relaxed });
    }

    chosen[section] = state.picked;
    log.info('section-select.picked', {
      section,
      eligible: eligible.length,
      picked: state.picked.length,
      community: state.communityCount,
      first_party_or_media: state.firstPartyOrMediaCount,
      distinct_companies: state.distinctCompanies.size,
      distinct_types: state.distinctTypes.size,
      per_company: Object.fromEntries(state.perCompany),
      per_type: Object.fromEntries(state.perType),
      target: targets[section],
      picks: state.picked.map((c) => ({
        source_group: c.source_group,
        source_name: c.source_name,
        company: detectCompany(c),
        type: detectEventType(c),
        title: c.title.slice(0, 120),
      })),
    });
  }
  return chosen;
}
