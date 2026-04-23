import { format } from 'date-fns';
import { getArchivedDates, getTodayArticles, groupBySection, isDemoMode } from '@/lib/data-source';
import { Navigation } from '@/components/Navigation';
import { DemoModeBanner } from '@/components/DemoModeBanner';
import { DailyBrief } from '@/components/DailyBrief';
import { GrowthInsight } from '@/components/GrowthInsight';
import { LaunchRadar } from '@/components/LaunchRadar';
import { DailyCase } from '@/components/DailyCase';
import { SectionNav } from '@/components/SectionNav';
import { Footer } from '@/components/Footer';

export const revalidate = 300;

export default async function HomePage() {
  const [articles, archivedDates] = await Promise.all([
    getTodayArticles(),
    getArchivedDates(),
  ]);
  const groups = groupBySection(articles);
  const latestDate = articles[0]?.date ?? format(new Date(), 'yyyy-MM-dd');
  const demo = isDemoMode();

  return (
    <>
      <Navigation displayDate={latestDate} archivedDates={archivedDates} />
      <DemoModeBanner active={demo} date={latestDate} />
      <div className="je-body">
        <SectionNav />
        <main className="je-main">
          <DailyBrief articles={groups.daily_brief ?? []} />
          <GrowthInsight articles={groups.growth_insight ?? []} />
          <LaunchRadar articles={groups.launch_radar ?? []} />
          <DailyCase articles={groups.daily_case ?? []} />
        </main>
      </div>
      <Footer />
    </>
  );
}
