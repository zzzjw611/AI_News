export type DotColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'cpurple';

// Color assignments for the fixed tag pools (see src/lib/tagPool.ts).
// Unknown slugs fall back to 'blue'.
const TAG_TO_COLOR: Record<string, DotColor> = {
  // News pool (daily_brief / growth_insight / launch_radar)
  launch: 'pink',
  funding: 'orange',
  acquisition: 'orange',
  partnership: 'blue',
  regulation: 'cpurple',
  security: 'cpurple',
  people: 'blue',
  infrastructure: 'blue',
  research: 'green',
  pricing: 'green',
  'open-source': 'green',
  enterprise: 'pink',
  consumer: 'pink',
  agent: 'pink',
  'developer-tool': 'green',
  indie: 'green',

  // Case pool (daily_case)
  舆论: 'cpurple',
  品宣: 'pink',
  用户增长: 'green',
  发布策略: 'pink',
  品牌信任: 'orange',
  社区运营: 'blue',
  销售转化: 'green',
  生态合作: 'blue',
};

export function tagDotColor(tags: string[] | null | undefined): DotColor {
  if (!tags || tags.length === 0) return 'blue';
  for (const raw of tags) {
    const t = raw.toLowerCase();
    if (TAG_TO_COLOR[t]) return TAG_TO_COLOR[t];
  }
  return 'blue';
}

export function tagPillColor(tag: string): DotColor {
  const t = tag.toLowerCase();
  return TAG_TO_COLOR[t] ?? 'blue';
}
