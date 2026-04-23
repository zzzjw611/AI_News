/**
 * Tag pools — fixed vocabulary with bilingual display labels.
 * Stored slug = the string persisted in article.tags[] and emitted by the
 * LLM. Frontend calls localizeTag(slug, language) to get the pill label.
 *
 * Two pools:
 *   NEWS_POOL — daily_brief / growth_insight / launch_radar. Slugs are
 *     English kebab-case; this is what the LLM emits.
 *   CASE_POOL — daily_case only. Slugs are Chinese; the LLM emits Chinese
 *     directly because the pool is a marketing-play taxonomy chosen for
 *     brevity in its native language.
 */

interface TagEntry {
  slug: string;
  zh: string;
  en: string;
}

export const NEWS_POOL: readonly TagEntry[] = [
  { slug: 'launch',         zh: '发布',       en: 'Launch' },
  { slug: 'funding',        zh: '融资',       en: 'Funding' },
  { slug: 'acquisition',    zh: '收购',       en: 'Acquisition' },
  { slug: 'partnership',    zh: '合作',       en: 'Partnership' },
  { slug: 'regulation',     zh: '监管',       en: 'Regulation' },
  { slug: 'security',       zh: '安全',       en: 'Security' },
  { slug: 'people',         zh: '人事',       en: 'People' },
  { slug: 'infrastructure', zh: '基建',       en: 'Infrastructure' },
  { slug: 'research',       zh: '研究',       en: 'Research' },
  { slug: 'pricing',        zh: '定价',       en: 'Pricing' },
  { slug: 'open-source',    zh: '开源',       en: 'Open Source' },
  { slug: 'enterprise',     zh: '企业级',     en: 'Enterprise' },
  { slug: 'consumer',       zh: '消费级',     en: 'Consumer' },
  { slug: 'agent',          zh: 'Agent',      en: 'Agent' },
  { slug: 'developer-tool', zh: '开发者工具', en: 'Developer Tool' },
  { slug: 'indie',          zh: '独立产品',   en: 'Indie' },
];

export const CASE_POOL: readonly TagEntry[] = [
  { slug: '舆论',     zh: '舆论',     en: 'Public Opinion' },
  { slug: '品宣',     zh: '品宣',     en: 'Brand Marketing' },
  { slug: '用户增长', zh: '用户增长', en: 'User Growth' },
  { slug: '发布策略', zh: '发布策略', en: 'Launch Strategy' },
  { slug: '品牌信任', zh: '品牌信任', en: 'Brand Trust' },
  { slug: '社区运营', zh: '社区运营', en: 'Community' },
  { slug: '销售转化', zh: '销售转化', en: 'Sales Conversion' },
  { slug: '生态合作', zh: '生态合作', en: 'Ecosystem' },
];

const ALL_TAGS = [...NEWS_POOL, ...CASE_POOL];
const TAG_MAP = new Map(ALL_TAGS.map((t) => [t.slug, t]));

export function localizeTag(slug: string, language: 'zh' | 'en'): string {
  const entry = TAG_MAP.get(slug);
  if (!entry) return slug; // unknown tag — render raw slug so bugs are visible
  return language === 'zh' ? entry.zh : entry.en;
}

export function isNewsTag(slug: string): boolean {
  return NEWS_POOL.some((t) => t.slug === slug);
}

export function isCaseTag(slug: string): boolean {
  return CASE_POOL.some((t) => t.slug === slug);
}
