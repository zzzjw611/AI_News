import type { Article } from '@/lib/types';

/** Stable key for an article even when `id` is absent (e.g., live cache). */
export function articleKey(article: Article): string {
  if (article.id) return article.id;
  return `${article.section}-${article.order_in_section}-${article.date}`;
}
