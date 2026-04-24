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
  const brand = language === 'zh' ? 'WeLike · AI 营销日报' : 'WeLike · AI Marketer Daily';
  const slogan =
    language === 'zh'
      ? '8 分钟 AI 营销人每日简报'
      : '8min Daily Briefing for AI Marketers';
  const archiveLabel = onArchivePage
    ? language === 'zh'
      ? '← 返回今日'
      : '← Today'
    : language === 'zh'
      ? '往期 →'
      : 'Archive →';
  return (
    <header className="je-nav">
      <div className="nav-left nav-left-stacked">
        <Link href="/" className="nav-brand">
          {brand}
        </Link>
        <span className="nav-slogan">{slogan}</span>
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
