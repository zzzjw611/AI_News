import type { Candidate } from './types';

/**
 * Lightweight NER for section-select diversity caps. We match the
 * candidate's title + raw_text + source_name against an ordered alias
 * list; first hit wins. This is intentionally heuristic — a proper NER
 * system is out of scope; this is cheap enough to run on every candidate.
 *
 * Ordering matters: more specific / product-name aliases should come
 * before ambiguous generic ones ("grok" before "xAI", "claude" before
 * "anthropic") so the most unambiguous token anchors the match.
 */
const COMPANY_ALIASES: Array<[string, string[]]> = [
  ['OpenAI', ['openai', 'open ai', 'chatgpt', 'gpt-5', 'gpt-4', 'gpt-3', 'sam altman', 'sora ', 'dall-e', 'codex ', "openai's"]],
  ['Anthropic', ['anthropic', 'claude ', 'claude code', 'claude mythos', "anthropic's"]],
  ['Google', ['google', 'deepmind', 'alphabet', 'gemini', ' tpu ', "google's"]],
  ['Meta', ['meta ai', ' llama', 'facebook', 'zuckerberg', "meta's"]],
  ['Microsoft', ['microsoft', 'copilot', 'azure openai', 'bing chat']],
  ['Apple', ['apple intelligence', "apple's", 'siri ']],
  ['Amazon', ['amazon bedrock', ' aws ', 'aws ai']],
  ['Nvidia', ['nvidia']],
  ['xAI', [' xai ', 'grok', 'elon musk']],
  ['Mistral', ['mistral ai', 'mixtral', 'mistral large', 'mistral medium']],
  ['Perplexity', ['perplexity']],
  ['Cohere', ['cohere']],
  ['Hugging Face', ['hugging face', 'huggingface']],
  ['Replit', ['replit']],
  ['Vercel', ['vercel']],
  ['Cursor', ['cursor ', "cursor's"]],
  ['Stripe', ['stripe ']],
  ['Shopify', ['shopify']],
  ['Figma', ['figma']],
  ['Notion', ['notion ', "notion's"]],
  ['Linear', ['linear app', 'linear.app']],
  ['Palantir', ['palantir']],
  ['Databricks', ['databricks']],
  ['Snowflake', ['snowflake']],
  ['Tesla', ['tesla', 'fsd ']],
  ['SpaceX', ['spacex']],
  // Chinese companies
  ['ByteDance', ['bytedance', '字节跳动', '抖音', 'tiktok', 'doubao', '豆包']],
  ['Alibaba', ['alibaba', '阿里巴巴', '通义', 'qwen', 'tongyi']],
  ['Tencent', ['tencent', '腾讯', 'wechat', '微信']],
  ['Baidu', ['baidu', '百度', 'ernie']],
  ['Xiaomi', ['xiaomi', '小米']],
  ['Huawei', ['huawei', '华为', 'ascend']],
  ['Meituan', ['meituan', '美团']],
  ['JD.com', ['jd.com', '京东']],
  ['DeepSeek', ['deepseek']],
  ['Moonshot AI', ['moonshot ai', 'kimi']],
  ['Zhipu AI', ['zhipu', '智谱', 'glm-']],
  ['01.AI', ['01.ai', '零一万物', 'yi-large']],
  ['StepFun', ['stepfun', '阶跃星辰']],
  ['MiniMax', ['minimax']],
];

export function detectCompany(c: Pick<Candidate, 'title' | 'raw_text' | 'source_name'>): string | null {
  const haystack = `${c.title} ${c.raw_text ?? ''} ${c.source_name}`.toLowerCase();
  for (const [company, aliases] of COMPANY_ALIASES) {
    for (const alias of aliases) {
      if (haystack.includes(alias)) return company;
    }
  }
  return null;
}

/**
 * Event-type taxonomy for diversity caps. Order = priority:
 * more-specific categories first so "security" beats "launch" when a
 * "security incident about a product launch" shows up.
 */
const EVENT_TYPE_KEYWORDS: Array<[string, string[]]> = [
  ['security', ['breach', 'leak', 'hack', 'hacked', 'vulnerability', 'jailbreak', 'unauthorized', 'exploit', '泄露', '漏洞', '越权', '入侵', '被攻破']],
  ['regulation', ['regulator', 'regulation', 'regulatory', 'lawsuit', 'sued', 'court', 'ftc', 'sec ', 'eu ai act', 'ban ', 'banned', '监管', '禁止', '诉讼', '法案', '起诉']],
  ['funding', ['raised $', 'raises $', 'funding round', 'series a', 'series b', 'series c', 'series d', 'valuation', 'valued at', 'acquires ', 'acquisition', 'ipo', '融资', '估值', '收购']],
  ['people', ['new ceo', 'hired ', 'fired ', 'departed', 'resign', 'joins ', 'appointed', 'steps down', '入职', '离职', '加入', '任命', '离开']],
  ['launch', ['launch', 'launches', 'release', 'releases', 'ships ', 'shipping', 'announces', 'announced', 'unveiled', 'unveils', 'rolls out', '发布', '推出', '上线', '推出']],
  ['partnership', ['partner ', 'partnership', 'teams up', 'integrates', '合作', '签约', '联手']],
  ['research', ['paper ', 'research ', 'benchmark', 'study ', 'published research', '论文', '研究', '实验结果']],
  ['infrastructure', ['data center', 'data centers', 'gpu cluster', 'compute cluster', 'supercomputer', '数据中心', 'gpu 集群']],
  ['marketing', ['campaign', 'rebrand', 'new ad', 'advertising', '营销', '广告', '重塑']],
  ['policy', ['policy change', 'pricing change', 'access restrict', '政策', '定价']],
];

export function detectEventType(c: Pick<Candidate, 'title' | 'raw_text'>): string | null {
  const haystack = `${c.title} ${c.raw_text ?? ''}`.toLowerCase();
  for (const [type, keywords] of EVENT_TYPE_KEYWORDS) {
    for (const kw of keywords) {
      if (haystack.includes(kw)) return type;
    }
  }
  return null;
}
