'use client';

import { useState } from 'react';
import type { Article } from '@/lib/types';
import { pickLocalized, useLanguage } from '@/lib/LanguageContext';
import { tagDotColor, tagPillColor } from '@/lib/tagColor';
import { articleKey } from '@/lib/articleKey';
import { SectionHead } from '@/components/SectionHead';
import { SourceLink } from '@/components/SourceLink';
import { EmptyWindow } from '@/components/EmptyWindow';

interface DailyBriefProps {
  articles: Article[];
}

export function DailyBrief({ articles }: DailyBriefProps) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (articles.length === 0) {
    return (
      <section className="section-wrap" id="daily-brief">
        <SectionHead
          emoji="📅"
          label={language === 'zh' ? '今日要点' : 'DAILY BRIEF'}
          color="green"
        />
        <EmptyWindow
          logName="newsdesk.log"
          headingEn="No news today"
          headingZh="今日停讯"
          bodyEn="No breaking AI industry news cleared our editorial bar today. Noise is not news — we’d rather skip than fill the slot. See you tomorrow."
          bodyZh="今日没有符合编辑标准的 AI 行业要闻。噪音不是新闻 —— 宁缺毋滥，明天见。"
        />
      </section>
    );
  }

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="section-wrap" id="daily-brief">
      <SectionHead
        emoji="📅"
        label={language === 'zh' ? 'DAILY BRIEF · 今日要点' : 'DAILY BRIEF'}
        color="green"
      />
      <ol className="tl">
        {articles.map((article, idx) => {
          const key = articleKey(article);
          const dot = tagDotColor(article.tags);
          const title = pickLocalized(article.title_en, article.title_zh, language);
          const body = pickLocalized(article.content_en, article.content_zh, language);
          const soWhat = pickLocalized(
            article.so_what_en ?? '',
            article.so_what_zh ?? null,
            language,
          );
          const isOpen = expanded.has(key);
          return (
            <li className="tl-item" key={key} id={`brief-${key}`}>
              <div className="tl-num">[{String(idx + 1).padStart(2, '0')}]</div>
              <div className="tl-nd">
                <span className={`dot ${dot}`} aria-hidden />
              </div>
              <article className="tl-card">
                <div className="ct">
                  <h3 className="ct-title">{title}</h3>
                  <SourceLink name={article.source_name} url={article.source_url} />
                </div>
                <div className="ct-body">{body}</div>
                {article.so_what_en ? (
                  <div className="ctx">
                    <div className="ctx-label">
                      {language === 'zh' ? '对 Marketer 的意义' : 'So What for Marketers'}
                    </div>
                    <div className="ctx-text">{soWhat}</div>
                  </div>
                ) : null}
                <div className="cf">
                  <div className="tags">
                    {article.tags.map((tag) => (
                      <span key={tag} className={`tag ${tagPillColor(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  {isOpen ? null : (
                    <button
                      type="button"
                      className="cf-more"
                      onClick={() => toggle(key)}
                    >
                      {language === 'zh' ? '展开 ↓' : 'more ↓'}
                    </button>
                  )}
                </div>
                {isOpen ? (
                  <div className="ct-body" style={{ marginTop: 8 }}>
                    {article.tags.length > 0 ? (
                      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
                        {language === 'zh' ? '分类：' : 'Tags: '}
                        {article.tags.join(' · ')}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="cf-more"
                      onClick={() => toggle(key)}
                    >
                      {language === 'zh' ? '收起 ↑' : 'less ↑'}
                    </button>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
