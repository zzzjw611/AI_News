import Parser from 'rss-parser';
import type { Candidate, SourceGroup } from '../types';
import { log } from '../log';

interface RSSFeed {
  name: string;
  url: string;
  group: SourceGroup;
  lang: 'en' | 'zh';
}

export const RSS_FEEDS: RSSFeed[] = [
  // First-party lab / big-tech blogs (brief_first_party + launch_changelogs + case_hot_companies)
  // Anthropic + Mistral have no public RSS. Meta AI blog has no RSS; engineering.fb.com is the
  // closest substitute for Meta infra / AI work.
  { name: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml', group: 'brief_first_party', lang: 'en' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', group: 'brief_first_party', lang: 'en' },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', group: 'brief_first_party', lang: 'en' },
  { name: 'Google DeepMind Blog', url: 'https://www.deepmind.com/blog/rss.xml', group: 'brief_first_party', lang: 'en' },
  { name: 'Meta Engineering', url: 'https://engineering.fb.com/feed/', group: 'brief_first_party', lang: 'en' },

  // Media (brief_media + case_deep_media)
  // Semafor + Founder Park dropped — no discoverable RSS. Substituted with verified mainstream tech / AI
  // outlets covering the same beat.
  { name: 'The Information', url: 'https://www.theinformation.com/feed', group: 'brief_media', lang: 'en' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', group: 'brief_media', lang: 'en' },
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', group: 'brief_media', lang: 'en' },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', group: 'brief_media', lang: 'en' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', group: 'brief_media', lang: 'en' },
  { name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/', group: 'brief_media', lang: 'en' },
  { name: 'Latent Space', url: 'https://www.latent.space/feed', group: 'brief_media', lang: 'en' },
  { name: 'Stratechery', url: 'https://stratechery.com/feed/', group: 'brief_media', lang: 'en' },
  { name: '量子位', url: 'https://www.qbitai.com/feed', group: 'brief_media', lang: 'zh' },
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss', group: 'brief_media', lang: 'zh' },
  { name: '36氪', url: 'https://36kr.com/feed', group: 'brief_media', lang: 'zh' },

  // Substack / newsletter whitelist (growth_substack)
  // Opinion-driven marketing, growth, and AI-product-building voices.
  // Every.to dropped — paywalled, no public RSS.
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed', group: 'growth_substack', lang: 'en' },
  { name: 'Not Boring (Packy McCormick)', url: 'https://www.notboring.co/feed', group: 'growth_substack', lang: 'en' },
  { name: 'Import AI (Jack Clark)', url: 'https://importai.substack.com/feed', group: 'growth_substack', lang: 'en' },
  { name: 'Platformer (Casey Newton)', url: 'https://www.platformer.news/feed', group: 'growth_substack', lang: 'en' },
  { name: 'One Useful Thing (Ethan Mollick)', url: 'https://www.oneusefulthing.org/feed', group: 'growth_substack', lang: 'en' },
  { name: 'AI Tidbits', url: 'https://www.aitidbits.ai/feed', group: 'growth_substack', lang: 'en' },
  { name: "Ben's Bites", url: 'https://bensbites.substack.com/feed', group: 'growth_substack', lang: 'en' },
];

const AI_RX = /\b(ai|llm|gpt|claude|gemini|agent|rag|openai|anthropic|deepmind|mistral|llama|deepseek|qwen|model|inference|multimodal|diffusion|sora|veo|copilot|cursor|perplexity|xai|grok)\b|人工智能|大模型|智能体|多模态|推理|训练|扩散/i;

type ParsedItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  isoDate?: string;
  pubDate?: string;
};

async function fetchFeedBody(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'application/atom+xml, application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Status code ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRss(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  const cutoff = opts.now.getTime() - opts.windowHours * 3600 * 1000;
  const parser = new Parser({ timeout: 15000 });
  const results: Candidate[] = [];

  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const body = await fetchFeedBody(feed.url);
        const parsed = await parser.parseString(body);
        for (const raw of parsed.items as ParsedItem[]) {
          if (!raw.title || !raw.link) continue;
          const published = raw.isoDate ?? raw.pubDate;
          if (!published) continue;
          const ts = new Date(published).getTime();
          if (!Number.isFinite(ts) || ts < cutoff) continue;
          const snippet = raw.contentSnippet ?? raw.content ?? '';
          const haystack = `${raw.title} ${snippet}`;
          if (!AI_RX.test(haystack)) continue;
          results.push({
            source_group: feed.group,
            source_name: feed.name,
            source_url: raw.link,
            title: raw.title,
            raw_text: snippet || null,
            published_at: new Date(ts).toISOString(),
            fetched_at: opts.now.toISOString(),
            lang: feed.lang,
            metrics: {},
            raw: raw as unknown as Record<string, unknown>,
          });
        }
      } catch (e) {
        log.warn('source.rss.feed.error', { feed: feed.name, err: String(e) });
      }
    }),
  );
  log.info('source.rss.done', { candidates: results.length });
  return results;
}
