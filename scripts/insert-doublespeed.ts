import fs from 'node:fs/promises';
import path from 'node:path';

const TITLE_ZH = 'Doublespeed：从虚拟网红到 AI Social Agent';
const TITLE_EN = 'Doublespeed: From Virtual Influencers to AI Social Agents';

const CONTENT_ZH = `Doublespeed 代表了一类新的 AI × 营销工具：它不只是生成图片、视频或文案，而是帮助品牌批量创建和运营 AI social agents。品牌可以为不同人群设计不同的虚拟人设，用它们测试内容方向、互动方式和转化路径。

## 关键数据
- **Metric 1** 过去一年企业对 AI creators / synthetic talent 的投入接近 $1.4B
- **Metric 2** 1 人可编排 30 人 creator team 的工作量，以约 10% 成本运行
- **Metric 3** 定位为 attention intelligence platform，批量部署 social agents 并持续学习用户互动

## 背景
传统品牌营销依赖真人 KOL、UGC 创作者和内部社媒团队，但这些方式往往成本高、产能不稳定、测试周期长。Doublespeed 的切入点是把"人设"产品化：品牌不再只是买单条内容，而是创建一组可持续发布、互动和优化的 AI 账号。

## 一、把"人设"变成可复制资产
过去，品牌买 KOL，本质上是买某个真人的影响力。现在，AI social agents 让品牌可以按目标人群设计人设，例如专业测评型、陪伴型、毒舌吐槽型或行业专家型。

这意味着"人设"会变成新的营销资产。品牌可以同时测试多个表达方式，看哪一种更能带来点击、私信、注册或购买。

## 二、不是内容工厂，而是实验系统
Doublespeed 的价值不在于"多生成几条内容"，而在于更快地测试注意力。一个社媒团队过去一周只能测试有限选题；AI agents 可以同时测试几十种内容角度、人设和发布时间。

真正的变化是，A/B testing 不再只发生在 landing page 上，也可以发生在账号人设、内容风格和互动方式上。

## 三、风险：效率不能替代真实性
这个案例不能只看增长效率。AI 虚拟账号如果伪装成真人、批量制造虚假互动，可能引发平台政策和品牌信任风险。

更安全的做法是明确披露 AI avatar / virtual creator 身份，把 AI 用在产品讲解、内容本地化、短视频脚本和品牌教育中，而不是做虚假口碑。

## 三条可迁移经验
- **不要只做 AI content，要做 AI content system** 建立选题池、脚本模板、发布节奏和数据复盘机制
- **人设是新的增长入口** 不同客群需要不同表达；先设计 3 个 AI 人设：专家型、陪伴型、测评型
- **KPI 要看转化，不只看点赞** 绑定注册、私信、demo booking 或购买

## 本周动作清单
- [ ] 设计 3 个品牌 AI 人设：目标用户、语气、内容栏目和禁用表达
- [ ] 从现有内容中拆出 5 类可复用栏目：产品演示 / 用户故事 / 行业观点 / FAQ / 对比测评
- [ ] 用 AI 生成 30 条脚本，人工筛选 5 条发布，并追踪注册、私信或点击
- [ ] 明确标注 AI avatar 身份，不做伪装真人的虚假互动`;

const CONTENT_EN = `Doublespeed represents a new category of AI marketing tools. It does not simply generate images, videos, or copy; it helps brands create and operate AI social agents at scale. Brands can design different synthetic personas for different audiences, then test content angles, engagement styles, and conversion paths.

## Key Numbers
- **Metric 1** Companies have invested nearly $1.4B in AI creators / synthetic talent over the past year
- **Metric 2** One person can orchestrate the work of a 30-person creator team at roughly 10% of the cost
- **Metric 3** Positioned as an attention intelligence platform — deploying social agents at scale and learning from audience interactions

## Background
Traditional brand marketing relies on human KOLs, UGC creators, and internal social teams. These approaches are often expensive, inconsistent, and slow to test. Doublespeed's key idea is to productize personas: instead of buying individual pieces of content, brands can create AI accounts that continuously publish, interact, and optimize.

## 1. Turning Personas into Scalable Assets
In the past, working with influencers meant buying access to a real person's audience. With AI social agents, brands can design personas for specific audiences, such as expert reviewers, friendly companions, sharp commentators, or industry specialists.

This means personas become a new type of marketing asset. Brands can test multiple tones and identities at the same time to see which one drives more clicks, DMs, sign-ups, or purchases.

## 2. Not a Content Factory, but an Experiment System
Doublespeed's value is not simply generating more content; it is testing attention faster. A social team may only test a few ideas per week, while AI agents can test dozens of angles, personas, and posting schedules at once.

The real shift is that A/B testing no longer only happens on landing pages. It can now happen at the level of personas, content styles, and interaction patterns.

## 3. Risk: Efficiency Cannot Replace Authenticity
This case is not only about efficiency. If AI accounts pretend to be real people or create fake engagement at scale, they may trigger platform policy issues and damage brand trust.

A safer approach is to clearly disclose AI avatars or virtual creators and use AI for product explainers, localization, short-video scripts, and brand education, rather than fake social proof.

## Transferable Lessons
- **Do not just use AI for content — build an AI content system** Pools of topics, script templates, publishing rhythms, and performance reviews
- **Personas are a new growth surface** Different audiences need different voices; start with three AI personas (expert, companion, reviewer)
- **KPIs should track conversion, not likes** Tie experiments to sign-ups, DMs, demo bookings, or purchases

## This Week's Checklist
- [ ] Design three brand AI personas: target audience, tone, content columns, and prohibited expressions
- [ ] Extract five reusable content formats from your existing library: product demos / user stories / industry insights / FAQs / comparison reviews
- [ ] Generate 30 scripts with AI, manually select five to publish, and track sign-ups, DMs, or clicks
- [ ] Clearly label AI avatars and avoid fake engagement that pretends to come from real people`;

const DOUBLESPEED_CASE = {
  id: '2026-04-24-daily_case-1',
  date: '2026-04-24',
  section: 'daily_case' as const,
  order_in_section: 1,
  title_en: TITLE_EN,
  title_zh: TITLE_ZH,
  content_en: CONTENT_EN,
  content_zh: CONTENT_ZH,
  so_what_en:
    "AI social agents turn personas into testable marketing assets. The content factory model needs to upgrade into an experiment system.",
  so_what_zh:
    'AI social agent 让"人设"变成可测试的营销资产；内容工厂模式需要升级为实验系统。',
  source_name: 'Editorial · JE Labs',
  source_url: 'https://www.doublespeed.ai',
  tags: ['品宣', '用户增长', '销售转化'],
  status: 'published' as const,
  created_at: new Date().toISOString(),
  published_at: new Date().toISOString(),
  metadata: {
    source_group: 'case_user_requests',
    generated_by: 'manual-curation',
  },
};

async function updateFile(filePath: string): Promise<void> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const doc = JSON.parse(raw) as { articles: Array<{ section: string }> };
  const kept = doc.articles.filter((a) => a.section !== 'daily_case');
  kept.push(DOUBLESPEED_CASE);
  const SECTION_ORDER = ['daily_brief', 'growth_insight', 'launch_radar', 'daily_case'];
  kept.sort((a, b) => SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section));
  const updated = { ...doc, articles: kept };
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2) + '\n');
  console.log('updated', filePath);
}

async function main(): Promise<void> {
  const root = process.cwd();
  await updateFile(path.join(root, 'src/data/issues/2026-04-24.json'));
  await updateFile(path.join(root, 'src/data/latest.json'));
  console.log('\nDone. Refresh localhost:3002 to preview.');
  console.log('Note: running generate:daily with --rerun WILL overwrite this manual case.');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
