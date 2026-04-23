'use client';

import { useLanguage } from '@/lib/LanguageContext';
import { SectionHead } from '@/components/SectionHead';

export function ArchiveSectionHead() {
  const { language } = useLanguage();
  return (
    <SectionHead
      emoji="🗄️"
      label={language === 'zh' ? '历史刊期' : 'ARCHIVE'}
      color="purple"
    />
  );
}

export function ArchiveEmpty() {
  const { language } = useLanguage();
  return (
    <p className="ct-body">
      {language === 'zh' ? '尚无历史刊期。' : 'No archived issues yet.'}
    </p>
  );
}
