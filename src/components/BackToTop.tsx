'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

export function BackToTop() {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    const recompute = () => {
      const openDetails = Array.from(
        document.querySelectorAll<HTMLDetailsElement>(
          'details[data-archive-issue][open]',
        ),
      );
      if (openDetails.length === 0) {
        setVisible(false);
        setTargetId(null);
        return;
      }
      const current =
        openDetails.find((d) => {
          const r = d.getBoundingClientRect();
          return r.top <= window.innerHeight / 2 && r.bottom > 0;
        }) ?? openDetails[openDetails.length - 1];
      const rect = current.getBoundingClientRect();
      const scrolledPastTop = rect.top < 0;
      const nearBottom = rect.bottom <= window.innerHeight + 240;
      setTargetId(current.id);
      setVisible(scrolledPastTop && nearBottom);
    };
    recompute();
    window.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);
    document.addEventListener('toggle', recompute, true);
    return () => {
      window.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
      document.removeEventListener('toggle', recompute, true);
    };
  }, []);

  const handleClick = () => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="back-to-top"
      aria-label={language === 'zh' ? '回到顶部' : 'Back to top'}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
      <span>{language === 'zh' ? '回到顶部' : 'Back to top'}</span>
    </button>
  );
}
