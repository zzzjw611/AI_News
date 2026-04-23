'use client';

import type { ReactNode } from 'react';
import type { Article } from '@/lib/types';
import { pickLocalized, useLanguage } from '@/lib/LanguageContext';
import { tagPillColor } from '@/lib/tagColor';
import { localizeTag } from '@/lib/tagPool';
import { articleKey } from '@/lib/articleKey';
import { SectionHead } from '@/components/SectionHead';
import { SourceLink } from '@/components/SourceLink';
import { EmptyWindow } from '@/components/EmptyWindow';

interface LaunchRadarProps {
  articles: Article[];
}

function getMetaString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function parseBullets(text: string): string[] | null {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines.every((l) => /^[-*•]\s+/.test(l))) return null;
  return lines.map((l) => l.replace(/^[-*•]\s+/, '').trim()).filter(Boolean);
}

function renderLrText(text: string): ReactNode {
  const bullets = parseBullets(text);
  if (bullets) {
    return (
      <ul className="lr-bullets">
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    );
  }
  return <span className="lr-text">{text}</span>;
}

function formatLaunchDate(iso: string | null, language: 'en' | 'zh'): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // fall back to raw string
  if (language === 'zh') {
    return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function LaunchRadar({ articles }: LaunchRadarProps) {
  const { language } = useLanguage();
  if (articles.length === 0) {
    return (
      <section className="section-wrap" id="launch-radar">
        <SectionHead
          emoji="🚀"
          label={language === 'zh' ? '新品雷达' : 'LAUNCH RADAR'}
          color="pink"
        />
        <EmptyWindow
          logName="launchdesk.log"
          headingEn="Nothing launching today"
          headingZh="今日无新品"
          bodyEn="No AI product on Product Hunt / Hacker News / YC surfaced as worth your attention today. We only ship launches worth your time. See you tomorrow."
          bodyZh="今日 Product Hunt / Hacker News / YC 上没有值得关注的 AI 产品。只推值得花时间看的新品，明天见。"
        />
      </section>
    );
  }

  return (
    <section className="section-wrap" id="launch-radar">
      <SectionHead
        emoji="🚀"
        label={language === 'zh' ? 'LAUNCH RADAR · 新品雷达' : 'LAUNCH RADAR'}
        color="pink"
      />
      <div className="lr-grid">
        {articles.map((article, idx) => {
          const title = pickLocalized(article.title_en, article.title_zh, language);
          const body = pickLocalized(article.content_en, article.content_zh, language);
          const soWhat = pickLocalized(
            article.so_what_en ?? '',
            article.so_what_zh ?? null,
            language,
          );
          const metadata = article.metadata ?? {};
          const platform = getMetaString(metadata, 'platform_data');
          const launchIso = getMetaString(metadata, 'launch_date');
          const launchPretty = formatLaunchDate(launchIso, language);
          const positioning = pickLocalized(
            getMetaString(metadata, 'positioning_en') ?? '',
            getMetaString(metadata, 'positioning_zh'),
            language,
          );
          const num = `[${String(idx + 1).padStart(2, '0')}]`;
          return (
            <article className="plain-card lr-card" key={articleKey(article)}>
              <div className="lr-aside">
                <div className="lr-head">
                  <span className="lr-num">{num}</span>
                  <h3 className="lr-title">{title}</h3>
                </div>
                {(launchPretty || platform) ? (
                  <div className="lr-meta">
                    {launchPretty ? <span>{launchPretty}</span> : null}
                    {launchPretty && platform ? <span className="lr-dot">·</span> : null}
                    {platform ? <span>{platform}</span> : null}
                  </div>
                ) : null}
                <div className="lr-foot">
                  <span className="lr-link-icon" aria-hidden>🔗</span>
                  <SourceLink name={article.source_name} url={article.source_url} />
                </div>
                {article.tags.length > 0 ? (
                  <div className="cf">
                    <div className="tags">
                      {article.tags.map((tag) => (
                        <span key={tag} className={`tag ${tagPillColor(tag)}`}>
                          {localizeTag(tag, language)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="lr-body">
                <div className="lr-block">
                  <span className="lr-label">{language === 'zh' ? '产品介绍' : 'What'}</span>
                  {renderLrText(body)}
                </div>
                {positioning ? (
                  <div className="lr-block">
                    <span className="lr-label">
                      {language === 'zh' ? '定位解读' : 'Positioning Read'}
                    </span>
                    {renderLrText(positioning)}
                  </div>
                ) : null}
                {article.so_what_en ? (
                  <div className="lr-block lr-takeaway">
                    <span className="lr-label">
                      👉 {language === 'zh' ? '营销行动' : 'Marketer Takeaway'}
                    </span>
                    {renderLrText(soWhat)}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
