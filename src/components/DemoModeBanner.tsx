'use client';

import { useLanguage } from '@/lib/LanguageContext';

interface DemoModeBannerProps {
  active: boolean;
  date?: string;
}

export function DemoModeBanner({ active, date }: DemoModeBannerProps) {
  const { language } = useLanguage();
  if (!active) return null;
  const d = date ?? '2026-04-20';
  return (
    <div className="demo-banner">
      🟢 {language === 'zh' ? `演示模式 — 示例数据（${d}）` : `Demo Mode — Sample data from ${d}`}
    </div>
  );
}
