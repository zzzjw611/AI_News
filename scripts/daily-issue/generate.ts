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
}): Promise<Article[]> {
  const { client, model, section, targets, candidates, date } = opts;
  if (candidates.length === 0 || targets.max === 0) {
    log.info('generate.section.skip', { section, reason: 'empty-pool-or-zero-target' });
    return [];
  }
  const userPrompt = buildUserPrompt(section, targets, candidates);

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
  try {
    parsed = ResponseSchema.parse(JSON.parse(extracted));
  } catch (firstErr) {
    log.warn('generate.parse.retry', {
      section,
      err: String(firstErr),
    });
    // One self-heal attempt: echo Claude's prior reply, then request a repair.
    response = await callClaude([
      { role: 'user', content: userPrompt },
      { role: 'assistant', content: text },
      {
        role: 'user',
        content:
          `Your previous response failed JSON.parse with: ${String(firstErr)}.\n` +
          'Re-emit the SAME articles with identical content, fixing only the JSON syntax. ' +
          'Pay special attention to escaping inner double quotes. Return the JSON object only.',
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
