import type { ReactNode } from 'react';

type ChipColor = 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'cpurple';

interface SectionHeadProps {
  emoji: string;
  label: string;
  color: ChipColor;
  trailing?: ReactNode;
}

export function SectionHead({ emoji, label, color, trailing }: SectionHeadProps) {
  return (
    <div className="sec-hd">
      <span className="sec-hd-emoji" aria-hidden>
        {emoji}
      </span>
      <span className={`chip ${color}`}>{label}</span>
      <span className="sec-hd-rule" />
      {trailing}
    </div>
  );
}
