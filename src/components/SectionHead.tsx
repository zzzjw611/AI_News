'use client';

import type { ReactNode } from 'react';
import { useLanguage } from '@/lib/LanguageContext';

type ChipColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'cpurple';

interface SectionHeadProps {
  emoji: string;
  label: string;
  color: ChipColor;
  /** Article count for the section; renders "· N 条" / "· N cards" after the label. */
  count?: number;
  trailing?: ReactNode;
}

export function SectionHead({ emoji, label, color, count, trailing }: SectionHeadProps) {
  const { language } = useLanguage();
  const countLabel =
    typeof count === 'number'
      ? language === 'zh'
        ? `· ${count} 条`
        : `· ${count} ${count === 1 ? 'card' : 'cards'}`
      : null;
  return (
    <div className="sec-hd">
      <span className="sec-hd-emoji" aria-hidden>
        {emoji}
      </span>
      <span className={`chip ${color}`}>{label}</span>
      {countLabel ? <span className="sec-hd-count">{countLabel}</span> : null}
      <span className="sec-hd-rule" />
      {trailing}
    </div>
  );
}
