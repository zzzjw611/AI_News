import type { ArticleSection } from '../../src/lib/types';

export type SourceGroup =
  // Daily Brief
  | 'brief_first_party'
  | 'brief_community'
  | 'brief_media'
  | 'brief_regulation'
  | 'brief_data'
  // Growth Insight
  | 'growth_x_accounts'
  | 'growth_linkedin_posts'
  | 'growth_substack'
  | 'growth_podcasts'
  | 'growth_cn_creators'
  // Launch Radar
  | 'launch_producthunt'
  | 'launch_github_trending'
  | 'launch_x_launches'
  | 'launch_show_hn'
  | 'launch_changelogs'
  // Daily Case
  | 'case_hot_companies'
  | 'case_deep_media'
  | 'case_community_reaction'
  | 'case_data_evidence'
  | 'case_user_requests';

export interface Candidate {
  source_group: SourceGroup;
  source_name: string;
  source_url: string;
  title: string;
  raw_text: string | null;
  published_at: string;
  fetched_at: string;
  lang: 'en' | 'zh' | 'unknown';
  metrics: {
    hn_points?: number;
    hn_comments?: number;
    reddit_score?: number;
    reddit_comments?: number;
    github_stars_today?: number;
  };
  raw: Record<string, unknown>;
}

export interface PipelineConfig {
  targetDate: string;
  // Width of the fetch window (hours).
  fetchWindowHours: number;
  // How many hours before `now` the window ENDS. The window is
  // [now - bufferHours - windowHours, now - bufferHours]. Default 1h gives a
  // buffer for late-publishing sources and keeps the window aligned with
  // user-visible push time rather than raw cron-fire time.
  fetchBufferHours: number;
  dedupWindowDays: number;
  sectionTargets: Record<ArticleSection, { min: number; max: number }>;
  dryRun: boolean;
  model: string;
}

export interface RunContext {
  config: PipelineConfig;
  now: Date;
  rootDir: string;
}
