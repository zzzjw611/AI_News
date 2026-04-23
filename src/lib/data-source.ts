import fs from 'node:fs/promises';
import path from 'node:path';
import demoData from '@/data/demo-data.json';
import indexData from '@/data/index.json';
import latestData from '@/data/latest.json';
import type { Article, ArticleSection } from '@/lib/types';

interface DemoFile {
  issue?: { date: string; status: string };
  articles: Article[];
}

interface IssueFile {
  date: string;
  generatedAt: string | null;
  articles: Article[];
}

interface IndexFile {
  dates: string[];
}

const demo = demoData as unknown as DemoFile;
const latest = latestData as unknown as IssueFile;
const index = indexData as unknown as IndexFile;

const ISSUES_DIR = path.join(process.cwd(), 'src/data/issues');

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
}

function hasLiveContent(): boolean {
  return index.dates.length > 0 && latest.articles.length > 0;
}

async function readIssue(date: string): Promise<IssueFile | null> {
  try {
    const raw = await fs.readFile(path.join(ISSUES_DIR, `${date}.json`), 'utf-8');
    return JSON.parse(raw) as IssueFile;
  } catch {
    return null;
  }
}

export async function getTodayArticles(): Promise<Article[]> {
  if (hasLiveContent()) return latest.articles;
  return demo.articles;
}

export async function getArticlesByDate(date: string): Promise<Article[]> {
  if (hasLiveContent()) {
    const issue = await readIssue(date);
    return issue?.articles ?? [];
  }
  return demo.articles.filter((a) => a.date === date);
}

export async function getArchivedDates(): Promise<string[]> {
  if (hasLiveContent()) return index.dates;
  const dates = Array.from(new Set(demo.articles.map((a) => a.date)))
    .sort()
    .reverse();
  return dates;
}

export function groupBySection(articles: Article[]): Record<ArticleSection, Article[]> {
  const groups: Record<ArticleSection, Article[]> = {
    daily_brief: [],
    growth_insight: [],
    launch_radar: [],
    daily_case: [],
  };
  for (const article of articles) {
    groups[article.section]?.push(article);
  }
  return groups;
}
