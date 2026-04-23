'use client';

import { useLanguage } from '@/lib/LanguageContext';

export function LanguageToggle() {
  const { language, toggle } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={language === 'zh' ? '切换语言' : 'Toggle language'}
      className="nav-lang-toggle"
    >
      <span className={`nav-lang-seg${language === 'zh' ? ' is-active' : ''}`}>中</span>
      <span className="nav-lang-sep" aria-hidden>/</span>
      <span className={`nav-lang-seg${language === 'en' ? ' is-active' : ''}`}>EN</span>
    </button>
  );
}
