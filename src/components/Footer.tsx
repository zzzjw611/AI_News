'use client';

import { useLanguage } from '@/lib/LanguageContext';

export function Footer() {
  const botUrl = process.env.NEXT_PUBLIC_TELEGRAM_BOT_URL;
  const { language } = useLanguage();
  return (
    <footer className="je-foot">
      <div className="je-foot-l">
        {language === 'zh' ? 'AI 营销日报 - JE Labs' : 'AI Marketer Daily - JE Labs'}
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
        <a
          href="https://je-kohl.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="je-foot-contact"
        >
          {language === 'zh' ? '联系 JE Labs' : 'Contact JE Labs'}
        </a>
      </div>
    </footer>
  );
}
