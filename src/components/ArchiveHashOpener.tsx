'use client';

import { useEffect } from 'react';

export function ArchiveHashOpener() {
  useEffect(() => {
    const openFromHash = () => {
      const raw = window.location.hash.replace(/^#/, '');
      if (!raw) return;
      const id = decodeURIComponent(raw);
      const target = document.getElementById(id);
      if (!(target instanceof HTMLDetailsElement)) return;
      document
        .querySelectorAll<HTMLDetailsElement>('details[data-archive-issue]')
        .forEach((d) => {
          d.open = d === target;
        });
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);
  return null;
}
