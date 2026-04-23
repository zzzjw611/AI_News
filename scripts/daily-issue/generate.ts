import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { Candidate } from './types';
import type { Article, ArticleSection } from '../../src/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { log } from './log';

const GeneratedArticleSchema = z.object({
  title_en: z.string().min(1),
  title_zh: z.string().min(1),
  content_en: z.string().min(1),
  content_zh: z.string().min(1),
  so_what_en: z.string().min(1),
  so_what_zh: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1).max(4),
  source_index: z.number().int().nonnegative(),
});

const ResponseSchema = z.object({
  articles: z.array(GeneratedArticleSchema),
});

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) return fence[1];
  const brace = trimmed.indexOf('{');
  if (brace >= 0) return trimmed.slice(brace);
  throw new Error('No JSON object in response');
}

export async function generateSection(opts: {
  client: Anthropic;
  model: string;
  section: ArticleSection;
  targets: { min: number; max: number };
  candidates: Candidate[];
  date: string;
  extraNote?: string;
}): Promise<Article[]> {
  const { client, model, section, targets, candidates, date, extraNote } = opts;
  if (candidates.length === 0 || targets.max === 0) {
    log.info('generate.section.skip', { section, reason: 'empty-pool-or-zero-target' });
    return [];
  }
  const base = buildUserPrompt(section, targets, candidates);
  const userPrompt = extraNote ? `${base}\n\n${extraNote}` : base;

  async function callClaude(messages: Anthropic.MessageParam[]): Promise<Anthropic.Message> {
    return client.messages.create({
      model,
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });
  }

  function extractText(msg: Anthropic.Message): string {
    return msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }

  let response = await callClaude([{ role: 'user', content: userPrompt }]);
  let text = extractText(response);
  if (response.stop_reason === 'max_tokens') {
    log.error('generate.truncated', {
      section,
      output_tokens: response.usage.output_tokens,
    });
    throw new Error(`Claude response for ${section} hit max_tokens — bump limit or shrink prompt.`);
  }

  let parsed: z.infer<typeof ResponseSchema>;
  let extracted = extractJson(text);
  const firstAttemptTextLen = text.length;
  try {
    parsed = ResponseSchema.parse(JSON.parse(extracted));
  } catch (firstErr) {
    log.warn('generate.parse.retry', {
      section,
      err: String(firstErr),
    });
    // Self-heal attempt. The old prompt was too gentle — when the first
    // attempt's JSON broke on a long structured output (e.g. daily_case
    // with nested bold labels), Claude sometimes returned an empty
    // articles array on retry as a shortcut. Be explicit: content was
    // fine, only the JSON wrapper broke, and DO NOT drop articles.
    response = await callClaude([
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: text },
      {
        role: 'user',
        content:
          `Your previous response was good CONTENT but had broken JSON SYNTAX (parse error: ${String(firstErr)}).\n\n` +
          'CRITICAL INSTRUCTIONS FOR THIS RETRY:\n' +
          '1. Re-emit EVERY article from your previous response. Do NOT reduce the count. Do NOT return an empty array.\n' +
          '2. Keep title_en / title_zh / content_en / content_zh / so_what_en / so_what_zh IDENTICAL to the previous content. Do NOT shorten, rephrase, or edit.\n' +
          '3. The ONLY thing to change: fix the JSON escaping. Specifically:\n' +
          '   - Replace every straight double quote (") inside any string value with single quote (\'), or Chinese 「」, or rewrite to remove the quote.\n' +
          '   - Escape literal newlines inside strings as \\n.\n' +
          '   - No trailing commas. No markdown code fences.\n' +
          '4. Return ONLY the JSON object.',
      },
    ]);
    text = extractText(response);
    extracted = extractJson(text);
    try {
      parsed = ResponseSchema.parse(JSON.parse(extracted));
    } catch (secondErr) {
      const posMatch = String(secondErr).match(/position (\d+)/);
      const pos = posMatch ? Number(posMatch[1]) : 0;
      const around = extracted.slice(Math.max(0, pos - 120), pos + 120);
      log.error('generate.parse.error', {
        section,
        err: String(secondErr),
        stop_reason: response.stop_reason,
        total_len: extracted.length,
        around_error: around,
        raw_head: extracted.slice(0, 800),
        raw_tail: extracted.slice(-400),
      });
      throw secondErr;
    }
    // Guard against the "give-up retry": if the first attempt had substantial
    // text (> 300 chars) but the retry parsed to an empty array, the model
    // shortcut rather than fix. Fail loudly so the caller can react instead
    // of silently publishing a blank section.
    if (parsed.articles.length === 0 && firstAttemptTextLen > 300) {
      log.error('generate.retry.shortcut', {
        section,
        firstAttemptTextLen,
        retryOutputTokens: response.usage.output_tokens,
      });
      throw new Error(
        `${section} self-heal retry returned 0 articles after a ${firstAttemptTextLen}-char first attempt. ` +
          'The model shortcut the retry instead of fixing JSON. Investigate the first-attempt output.',
      );
    }
  }
  // Post-parse bilingual integrity check. LLM sometimes mirrors the
  // Chinese version into content_en (or vice versa) as a shortcut,
  // violating the translation-lock rule. If detected, do one targeted
  // rewrite asking for a proper translation of just the offending field.
  const CJK = /[一-鿿]/;
  const leaky = parsed.articles.flatMap((a, i) => {
    const hits: Array<{ idx: number; field: 'title_en' | 'content_en' | 'so_what_en' }> = [];
    if (CJK.test(a.title_en)) hits.push({ idx: i, field: 'title_en' });
    if (CJK.test(a.content_en)) hits.push({ idx: i, field: 'content_en' });
    if (CJK.test(a.so_what_en)) hits.push({ idx: i, field: 'so_what_en' });
    return hits;
  });
  if (leaky.length > 0) {
    log.warn('generate.bilingual.cjk_in_en.retry', {
      section,
      leaky: leaky.map((l) => ({ article: l.idx, field: l.field })),
    });
    const fixPrompt =
      `Your previous response passed JSON parse but violated the translation-lock rule: ` +
      `${leaky.length} English field(s) contain Chinese characters. ` +
      `Affected: ${leaky.map((l) => `article[${l.idx}].${l.field}`).join(', ')}.\n\n` +
      'Re-emit the SAME JSON object with IDENTICAL content_zh / title_zh / so_what_zh. ' +
      'ONLY rewrite the offending English field(s) as proper native English translations — no Chinese characters anywhere in title_en / content_en / so_what_en. ' +
      'Brand names stay in English in both (e.g. OpenAI, Anthropic), Chinese company names use English alias in EN content (ByteDance / Alibaba / etc.). ' +
      'Do not shorten or drop any article. Return only the corrected JSON.';
    const fixResponse = await callClaude([
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: text },
      { role: 'user', content: fixPrompt },
    ]);
    const fixText = extractText(fixResponse);
    const fixExtracted = extractJson(fixText);
    try {
      const fixParsed = ResponseSchema.parse(JSON.parse(fixExtracted));
      // Verify the fix landed. If still leaky, log and keep the best we have
      // rather than loop indefinitely.
      const stillLeaky = fixParsed.articles.some(
        (a) => CJK.test(a.title_en) || CJK.test(a.content_en) || CJK.test(a.so_what_en),
      );
      if (stillLeaky) {
        log.error('generate.bilingual.cjk_in_en.still_leaky', { section });
      } else {
        parsed = fixParsed;
        response = fixResponse;
      }
    } catch (fixErr) {
      log.error('generate.bilingual.cjk_in_en.parse_failed', { section, err: String(fixErr) });
    }
  }

  log.info('generate.section.done', {
    section,
    articles: parsed.articles.length,
    stop_reason: response.stop_reason,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
  });

  const now = new Date().toISOString();
  const articles: Article[] = parsed.articles.map((a, i) => {
    const src = candidates[a.source_index] ?? candidates[0];
    return {
      id: `${date}-${section}-${i + 1}`,
      date,
      section,
      order_in_section: i + 1,
      title_en: a.title_en,
      title_zh: a.title_zh,
      content_en: a.content_en,
      content_zh: a.content_zh,
      so_what_en: a.so_what_en,
      so_what_zh: a.so_what_zh,
      source_name: src.source_name,
      source_url: src.source_url,
      tags: a.tags,
      status: 'published',
      created_at: now,
      published_at: now,
      metadata: {
        source_group: src.source_group,
        generated_by: 'daily-issue-pipeline',
      },
    };
  });
  return articles;
}
