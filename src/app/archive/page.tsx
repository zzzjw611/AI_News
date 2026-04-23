import { getArchivedDates, getArticlesByDate, groupBySection, isDemoMode } from '@/lib/data-source';
import { Navigation } from '@/components/Navigation';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { DailyBrief } from '@/components/DailyBrief';
import { GrowthInsight } from '@/components/GrowthInsight';
import { LaunchRadar } from '@/components/LaunchRadar';
import { DailyCase } from '@/components/DailyCase';
import { Footer } from '@/components/Footer';
import { ArchiveSectionHead, ArchiveEmpty } from '@/components/ArchiveSectionHead';
import { SectionNav } from '@/components/SectionNav';
import { ArchiveHashOpener } from '@/components/ArchiveHashOpener';
import { BackToTop } from '@/components/BackToTop';

export const revalidate = 300;

export default async function ArchivePage() {
  const dates = await getArchivedDates();
  const demo = isDemoMode();
  const visibleDates = demo ? dates.slice(0, 1) : dates;

  const issues = await Promise.all(
    visibleDates.map(async (date) => {
      const articles = await getArticlesByDate(date);
      return { date, groups: groupBySection(articles) };
    }),
  );

  return (
    <>
      <Navigation displayDate={visibleDates[0]} archivedDates={dates} onArchivePage />
      <DemoModeBanner active={demo} date={visibleDates[0]} />
      <ArchiveHashOpener />
      <div className="je-body">
        <SectionNav />
        <main className="je-main">
          <ArchiveSectionHead />
          {issues.length === 0 ? <ArchiveEmpty /> : null}
          {issues.map(({ date, groups }) => (
            <details
              key={date}
              id={date}
              data-archive-issue=""
              open={demo}
              style={{
                marginBottom: 24,
                border: '1px solid var(--border-2)',
                borderRadius: 10,
                background: 'var(--surface-1)',
                padding: '14px 18px',
              }}
            >
              <summary
                style={{
                  fontFamily: 'Space Mono, monospace',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--green)',
                  letterSpacing: '0.04em',
                  marginBottom: 12,
                }}
              >
                {date}
              </summary>
              <div style={{ marginTop: 16 }}>
                <DailyBrief articles={groups.daily_brief ?? []} />
                <GrowthInsight articles={groups.growth_insight ?? []} />
                <LaunchRadar articles={groups.launch_radar ?? []} />
                <DailyCase articles={groups.daily_case ?? []} />
              </div>
            </details>
          ))}
        </main>
      </div>
      <Footer />
      <BackToTop />
    </>
  );
}
