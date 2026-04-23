export type ArticleSection =
  | 'daily_brief'
  | 'growth_insight'
  | 'launch_radar'
  | 'daily_case';

export type ArticleStatus = 'draft' | 'approved' | 'published';

export type IssueStatus = 'draft' | 'review' | 'published';

export type SubscriberLanguage = 'en' | 'zh';

export type CandidateStatus = 'pending' | 'approved' | 'rejected';

export interface Article {
  id: string;
  date: string;
  section: ArticleSection;
  order_in_section: number;
  title_en: string;
  title_zh: string | null;
  content_en: string;
  content_zh: string | null;
  so_what_en: string | null;
  so_what_zh: string | null;
  source_name: string | null;
  source_url: string | null;
  tags: string[];
  status: ArticleStatus;
  created_at: string;
  published_at: string | null;
  metadata: Record<string, unknown>;
}

export interface DailyIssue {
  id: string;
  date: string;
  status: IssueStatus;
  published_at: string | null;
  created_at: string;
}

export interface TelegramSubscriber {
  id: string;
  chat_id: number;
  username: string | null;
  language: SubscriberLanguage;
  timezone: string;
  push_time: string;
  is_active: boolean;
  created_at: string;
}

export interface ContentCandidate {
  id: string;
  source_url: string | null;
  raw_content: string | null;
  ai_score: Record<string, unknown> | null;
  suggested_section: ArticleSection | null;
  ai_draft_en: string | null;
  ai_draft_zh: string | null;
  status: CandidateStatus;
  created_at: string;
}

export const SECTION_LABELS: Record<ArticleSection, { en: string; zh: string }> = {
  daily_brief: { en: 'Daily Brief', zh: '今日要点' },
  growth_insight: { en: 'Growth Insight', zh: '增长洞察' },
  launch_radar: { en: 'Launch Radar', zh: '新品雷达' },
  daily_case: { en: 'Daily Case', zh: '每日案例' },
};

export const SECTION_ORDER: ArticleSection[] = [
  'daily_brief',
  'growth_insight',
  'launch_radar',
  'daily_case',
];
