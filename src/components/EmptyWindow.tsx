'use client';

import { useLanguage } from '@/lib/LanguageContext';

interface EmptyWindowProps {
  /** Terminal-style filename shown in the title bar (e.g. "curator.log"). */
  logName: string;
  headingEn: string;
  headingZh: string;
  bodyEn: string;
  bodyZh: string;
}

export function EmptyWindow({
  logName,
  headingEn,
  headingZh,
  bodyEn,
  bodyZh,
}: EmptyWindowProps) {
  const { language } = useLanguage();
  return (
    <div className="empty-window" role="status" aria-live="polite">
      <div className="empty-window-bar">
        <span className="empty-window-dot red" aria-hidden />
        <span className="empty-window-dot yellow" aria-hidden />
        <span className="empty-window-dot green" aria-hidden />
        <span className="empty-window-title">{logName}</span>
      </div>
      <div className="empty-window-body">
        <div className="empty-window-heading">
          {language === 'zh' ? headingZh : headingEn}
        </div>
        <div className="empty-window-text">
          {language === 'zh' ? bodyZh : bodyEn}
        </div>
      </div>
    </div>
  );
}
