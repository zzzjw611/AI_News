# Manual Queue — Hand-Curated AI × Marketing Cases

你可以在 `src/data/manual-queue.json` 里挂任意 URL,pipeline 会把它们当成**最高优先级**候选(base score 260,高于所有 RSS 源),让它们必进 Daily Case(或你指定的其他板块)。

## 最简单的用法

打开 `src/data/manual-queue.json`,把你想让 LLM 拆解的 AI × 营销案例 URL 塞进去:

```json
{
  "items": [
    {
      "source_group": "case_user_requests",
      "source_name": "Lenny's Newsletter",
      "source_url": "https://www.lennysnewsletter.com/p/how-lovable-hit-100m-arr",
      "title": "Lovable hit $100M ARR in 18 months by building in public",
      "published_at": "2026-04-24T08:00:00Z",
      "lang": "en"
    }
  ]
}
```

commit + push → 下次 cron(或手动 Run workflow)会优先用这条。

## 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `source_group` | ✓ | 放 `case_user_requests` → Daily Case;也可以 `case_hot_companies` / `case_deep_media` / 等 |
| `source_name` | ✓ | 渲染在卡片底部的 "Source" 链接文字 |
| `source_url` | ✓ | 真实 URL,会被展示为可点击链接 |
| `title` | ✓ | 喂给 LLM 的候选标题(写清楚一句话) |
| `published_at` | ✓ | ISO 8601 格式。要让它出现在当日窗口,填今天 morning 时间 |
| `raw_text` | ○ | 可选。如果你复制 3-5 段原文精华粘进来,LLM 拆解会更精准 |
| `lang` | ○ | `zh` / `en`,不填默认 unknown |
| `expires_in_days` | ○ | 几天后不再候选,避免长期堆积(现在 fetcher 暂未实施此字段) |

## 工作流建议

1. 你在 Twitter / Substack / 微信 看到好案例 → 复制 URL
2. 打开 `src/data/manual-queue.json` 加一条
3. **可选**:把原文最有信息量的 3-5 段贴进 `raw_text`,拆解会更精准
4. commit + push
5. 下次 pipeline 运行时(cron 或手动)会优先用它
6. 发布成功后,你可以把这条删掉或留着(会被 dedup 自动过滤不重复出)

## 一次塞多条

可以塞 N 条,daily_case 只需要 1 条,所以 pipeline 会挑其中最"新鲜"(published_at 最近)的那条。其他会自然排在后面,留着做下一天的 fallback 也可以(或下一次 run 再删)。

## Source Group 参考

- `case_user_requests` → Daily Case 专用
- `case_hot_companies` → Daily Case(会被 FIRST_PARTY 分组加分,也算一手源)
- `case_deep_media` → Daily Case(深度媒体报道)
- `brief_first_party` → Daily Brief(大厂自家公告)
- `brief_marketer` → Daily Brief(营销媒体报道)
- `growth_substack` → Growth Insight(观点文章)

绝大多数场景直接用 `case_user_requests`。
