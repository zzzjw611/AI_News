'use client';

import { useLanguage } from '@/lib/LanguageContext';

export function Footer() {
  const botUrl = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;
  const { language } = useLanguage();
  return (
    <footer className="je-foot">
      <div className="je-foot-l">
        {language === 'zh'
          ? 'AI 营销日报 — 永久免费，无广告，无付费墙。'
          : 'AI Marketer Daily — Free forever. No ads. No paywall.'}
      </div>
      <div className="je-foot-r">
        {botUrl && (
          <a
            href={botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="je-foot-sub"
          >
            {language === 'zh' ? 'Telegram 订阅 →' : 'Subscribe on Telegram →'}
          </a>
        )}
        <span>{language === 'zh' ? '由 JE Labs 出品' : 'Powered by JE Labs'}</span>
      </div>
    </footer>
  );
}
