'use client';

import type { Article } from '@/lib/types';
import { pickLocalized, useLanguage } from '@/lib/LanguageContext';
import { articleKey } from '@/lib/articleKey';
import { SectionHead } from '@/components/SectionHead';
import { SourceLink } from '@/components/SourceLink';
import { EmptyWindow } from '@/components/EmptyWindow';

interface GrowthInsightProps {
  articles: Article[];
}

export function GrowthInsight({ articles }: GrowthInsightProps) {
  const { language } = useLanguage();

  if (articles.length === 0) {
    return (
      <section className="section-wrap" id="growth-insight">
        <SectionHead
          emoji="💡"
          label={language === 'zh' ? '增长洞察' : 'GROWTH INSIGHT'}
          color="blue"
        />
        <EmptyWindow
          logName="curator.log"
          headingEn="No picks today"
          headingZh="今日休刊"
          bodyEn="None of our curated experts posted anything that cleared the 7-day freshness + high-signal bar today. Editorial hold — we’d rather skip than fill the slot with filler. See you tomorrow."
          bodyZh="今日白名单专家没有产出符合 7 天时效 + 高信号标准的观点。宁缺毋滥 —— 我们不为了填版面而降低门槛。明天见。"
        />
      </section>
    );
  }

  return (
    <section className="section-wrap" id="growth-insight">
      <SectionHead
        emoji="💡"
        label={language === 'zh' ? '增长洞察' : 'GROWTH INSIGHT'}
        color="blue"
      />
      <div className="gi-stack">
        {articles.map((article) => {
          const body = pickLocalized(article.content_en, article.content_zh, language);
          const soWhat = pickLocalized(
            article.so_what_en ?? '',
            article.so_what_zh ?? null,
            language,
          );
          const title = pickLocalized(article.title_en, article.title_zh, language);
          return (
            <article className="plain-card" key={articleKey(article)}>
              <div className="ct">
                <h3 className="ct-title">{title}</h3>
                <SourceLink name={article.source_name} url={article.source_url} />
              </div>
              {article.source_name ? (
                <div className="gi-author">{article.source_name}</div>
              ) : null}
              <div className="ct-body quote">{body}</div>
              {article.so_what_en ? (
                <div className="ctx">
                  <div className="ctx-label">
                    {language === 'zh' ? '启发' : 'Marketer Takeaway'}
                  </div>
                  <div className="ctx-text">{soWhat}</div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
