'use client';

import type { Article } from '@/lib/types';
import { pickLocalized, useLanguage } from '@/lib/LanguageContext';
import { caseMarkdownToHtml } from '@/lib/markdown';
import { articleKey } from '@/lib/articleKey';
import { tagPillColor } from '@/lib/tagColor';
import { localizeTag } from '@/lib/tagPool';
import { SectionHead } from '@/components/SectionHead';
import { SourceLink } from '@/components/SourceLink';
import { EmptyWindow } from '@/components/EmptyWindow';

interface DailyCaseProps {
  articles: Article[];
}

export function DailyCase({ articles }: DailyCaseProps) {
  const { language } = useLanguage();
  if (articles.length === 0) {
    return (
      <section className="section-wrap" id="daily-case">
        <SectionHead
          emoji="📚"
          label={language === 'zh' ? '每日案例' : 'DAILY CASE'}
          color="orange"
        />
        <EmptyWindow
          logName="casedesk.log"
          headingEn="No case today"
          headingZh="今日无案例"
          bodyEn="No marketing case study worth a deep-dive surfaced today. A weak case is worse than no case. See you tomorrow."
          bodyZh="今日没有值得深入分析的营销案例。讲一个糟糕的案例不如不讲，明天见。"
        />
      </section>
    );
  }

  return (
    <section className="section-wrap" id="daily-case">
      <SectionHead
        emoji="📚"
        label={language === 'zh' ? 'DAILY CASE · 每日案例' : 'DAILY CASE'}
        color="orange"
      />
      <div className="gi-stack">
        {articles.map((article) => {
          const title = pickLocalized(article.title_en, article.title_zh, language);
          const body = pickLocalized(article.content_en, article.content_zh, language);
          const soWhat = pickLocalized(
            article.so_what_en ?? '',
            article.so_what_zh ?? null,
            language,
          );
          const html = caseMarkdownToHtml(body);
          return (
            <article className="plain-card dc-card" key={articleKey(article)}>
              <div className="ct">
                <h3 className="dc-title">{title}</h3>
                <SourceLink name={article.source_name} url={article.source_url} />
              </div>
              <div
                className="dc-content"
                dangerouslySetInnerHTML={{ __html: html }}
              />
              {article.so_what_en ? (
                <div className="ctx">
                  <div className="ctx-label">
                    {language === 'zh' ? '一句话要点' : 'One-Line Takeaway'}
                  </div>
                  <div className="ctx-text">{soWhat}</div>
                </div>
              ) : null}
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
