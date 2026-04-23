export type DotColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'cpurple';

const TAG_TO_COLOR: Record<string, DotColor> = {
  funding: 'orange',
  ipo: 'orange',
  money: 'orange',
  raise: 'orange',

  model: 'green',
  pricing: 'green',
  benchmark: 'green',

  policy: 'cpurple',
  legal: 'cpurple',
  regulation: 'cpurple',

  product: 'pink',
  launch: 'pink',
  agents: 'pink',

  industry: 'blue',
  partnership: 'blue',
  hardware: 'blue',

  growth: 'green',
  'llm-seo': 'green',
  conversion: 'blue',

  'case-study': 'orange',
  pr: 'orange',
  narrative: 'orange',
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
