import { z } from 'zod';
import type { Article } from '../../src/lib/types';

const SECTIONS = ['daily_brief', 'growth_insight', 'launch_radar', 'daily_case'] as const;

export const ArticleSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  section: z.enum(SECTIONS),
  order_in_section: z.number().int().positive(),
  title_en: z.string().min(1),
  title_zh: z.string().min(1).nullable(),
  content_en: z.string().min(1),
  content_zh: z.string().min(1).nullable(),
  so_what_en: z.string().min(1).nullable(),
  so_what_zh: z.string().min(1).nullable(),
  source_name: z.string().min(1).nullable(),
  source_url: z
    .string()
    .url()
    .nullable(),
  tags: z.array(z.string().min(1)),
  status: z.enum(['draft', 'approved', 'published']),
  created_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const IssueSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime().nullable(),
  articles: z.array(ArticleSchema),
});

export function validateArticles(articles: Article[]): void {
  for (const a of articles) {
    ArticleSchema.parse(a);
  }
}

export class PublishGateError extends Error {}

/**
 * Hard gate: the issue is allowed to publish even with some empty sections
 * (user confirmed "EmptyWindow fallback"), but must have at least ONE
 * article total. Empty issue = likely upstream breakage, fail loudly.
 */
export function assertPublishable(articles: Article[]): void {
  if (articles.length === 0) {
    throw new PublishGateError('No articles generated — aborting publish.');
  }
}
