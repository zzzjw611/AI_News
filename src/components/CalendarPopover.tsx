'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';

interface CalendarPopoverProps {
  archivedDates: string[];
}

export function CalendarPopover({ archivedDates }: CalendarPopoverProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const dateSet = useMemo(() => new Set(archivedDates), [archivedDates]);
  const { startMonth, endMonth, defaultMonth } = useMemo(() => {
    const sorted = [...archivedDates].sort();
    const today = new Date();
    const earliest = sorted.length > 0 ? parseISO(sorted[0]) : today;
    const latest = sorted.length > 0 ? parseISO(sorted[sorted.length - 1]) : today;
    return { startMonth: earliest, endMonth: today, defaultMonth: latest };
  }, [archivedDates]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const iso = format(date, 'yyyy-MM-dd');
    if (!dateSet.has(iso)) return;
    setOpen(false);
    if (window.location.pathname === '/archive') {
      if (window.location.hash === `#${iso}`) {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } else {
        window.location.hash = iso;
      }
    } else {
      router.push(`/archive#${iso}`);
    }
  };

  return (
    <div className="cal-pop-wrap" ref={wrapRef}>
      <button
        type="button"
        className="cal-btn"
        aria-label="Open calendar"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      {open ? (
        <div className="cal-pop" role="dialog" aria-label="Archive calendar">
          <DayPicker
            mode="single"
            onSelect={handleSelect}
            disabled={(d) => !dateSet.has(format(d, 'yyyy-MM-dd'))}
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={defaultMonth}
            modifiers={{
              contentful: (d) => dateSet.has(format(d, 'yyyy-MM-dd')),
            }}
            modifiersClassNames={{ contentful: 'has-content' }}
          />
        </div>
      ) : null}
    </div>
  );
}
