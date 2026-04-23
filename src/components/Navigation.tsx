'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useLanguage } from '@/lib/LanguageContext';
import { LanguageToggle } from '@/components/LanguageToggle';
import { CalendarPopover } from '@/components/CalendarPopover';

interface NavigationProps {
  displayDate?: string;
  archivedDates?: string[];
  onArchivePage?: boolean;
}

export function Navigation({
  displayDate,
  archivedDates = [],
  onArchivePage = false,
}: NavigationProps) {
  const { language } = useLanguage();
  const date = displayDate ?? format(new Date(), 'yyyy-MM-dd');
  const brand = language === 'zh' ? 'AI 营销日报' : 'AI Marketer Daily';
  const subtitle = language === 'zh' ? '情报简报' : 'Intelligence Brief';
  const archiveLabel = onArchivePage
    ? language === 'zh'
      ? '← 返回今日'
      : '← Today'
    : language === 'zh'
      ? '往期 →'
      : 'Archive →';
  return (
    <header className="je-nav">
      <div className="nav-left">
        <Link href="/" className="nav-brand">
          {brand}
        </Link>
        <span className="nav-sep">·</span>
        <span className="nav-sub">{subtitle}</span>
      </div>
      <div className="nav-right">
        <LanguageToggle />
        <div className="nav-date-block">
          <span className="nav-date-dot" aria-hidden />
          <span>{date}</span>
        </div>
        {archivedDates.length > 0 ? (
          <CalendarPopover archivedDates={archivedDates} />
        ) : null}
        <Link
          href={onArchivePage ? '/' : '/archive'}
          className="nav-archive"
        >
          {archiveLabel}
        </Link>
      </div>
    </header>
  );
}
