'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

const SECTIONS = [
  { id: 'daily-brief',     emoji: '📅', en: 'Daily Brief',     zh: '今日要点' },
  { id: 'growth-insight',  emoji: '💡', en: 'Growth Insight',  zh: '增长洞察' },
  { id: 'launch-radar',    emoji: '🚀', en: 'Launch Radar',    zh: '新品雷达' },
  { id: 'daily-case',      emoji: '📚', en: 'Daily Case',      zh: '每日案例' },
] as const;

export function SectionNav() {
  const { language } = useLanguage();
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const collect = () =>
      SECTIONS.flatMap((s) =>
        Array.from(document.querySelectorAll<HTMLElement>(`[id="${s.id}"]`)),
      );
    let elements = collect();
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));

    const onToggle = () => {
      observer.disconnect();
      elements = collect();
      elements.forEach((el) => observer.observe(el));
    };
    document.addEventListener('toggle', onToggle, true);
    return () => {
      observer.disconnect();
      document.removeEventListener('toggle', onToggle, true);
    };
  }, []);

  const handleClick = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const matches = Array.from(
      document.querySelectorAll<HTMLElement>(`[id="${id}"]`),
    );
    const el =
      matches.find((m) => {
        const det = m.closest('details');
        return det === null || det.open;
      }) ?? matches[0];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="je-nav-side"
      aria-label={language === 'zh' ? '快速指引' : 'Quick guide'}
    >
      <div className="je-nav-side-head">
        {language === 'zh' ? '快速指引' : 'Quick Guide'}
      </div>
      <ul className="je-nav-side-list">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => handleClick(e, s.id)}
              className={`je-nav-side-link${active === s.id ? ' is-active' : ''}`}
            >
              <span className="je-nav-side-emoji" aria-hidden>
                {s.emoji}
              </span>
              <span>{language === 'zh' ? s.zh : s.en}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
