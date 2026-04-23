import type { Candidate } from '../types';
import { log } from '../log';

// SEC EDGAR CIKs for AI-adjacent publicly traded companies.
// Extend this list as needed.
const WATCHED_CIKS: Array<{ cik: string; name: string }> = [
  { cik: '0001652044', name: 'Alphabet' },
  { cik: '0000789019', name: 'Microsoft' },
  { cik: '0001018724', name: 'Amazon' },
  { cik: '0001326801', name: 'Meta Platforms' },
  { cik: '0001045810', name: 'NVIDIA' },
  { cik: '0001318605', name: 'Tesla' },
  { cik: '0001783879', name: 'Palantir' },
];

interface EdgarRecent {
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      reportDate: string[];
      form: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

const INTERESTING_FORMS = new Set(['10-K', '10-Q', '8-K', 'S-1', '20-F']);

export async function fetchSecEdgar(opts: {
  windowHours: number;
  now: Date;
}): Promise<Candidate[]> {
  const cutoff = opts.now.getTime() - opts.windowHours * 3600 * 1000;
  const results: Candidate[] = [];
  for (const co of WATCHED_CIKS) {
    try {
      const res = await fetch(`https://data.sec.gov/submissions/CIK${co.cik}.json`, {
        headers: {
          'user-agent': 'ai-marketer-daily contact@example.com',
        },
      });
      if (!res.ok) {
        log.warn('source.sec.company.error', { name: co.name, status: res.status });
        continue;
      }
      const body = (await res.json()) as EdgarRecent;
      const r = body.filings.recent;
      for (let i = 0; i < r.accessionNumber.length; i += 1) {
        const form = r.form[i];
        if (!INTERESTING_FORMS.has(form)) continue;
        const filedAt = new Date(`${r.filingDate[i]}T16:00:00Z`).getTime();
        if (filedAt < cutoff) continue;
        const acc = r.accessionNumber[i].replace(/-/g, '');
        const url = `https://www.sec.gov/Archives/edgar/data/${Number(co.cik)}/${acc}/${r.primaryDocument[i]}`;
        results.push({
          source_group: 'case_data_evidence',
          source_name: `SEC · ${co.name}`,
          source_url: url,
          title: `${co.name} filed ${form}${r.primaryDocDescription[i] ? ` — ${r.primaryDocDescription[i]}` : ''}`,
          raw_text: null,
          published_at: new Date(filedAt).toISOString(),
          fetched_at: opts.now.toISOString(),
          lang: 'en',
          metrics: {},
          raw: { cik: co.cik, accession: r.accessionNumber[i], form },
        });
      }
    } catch (e) {
      log.warn('source.sec.company.error', { name: co.name, err: String(e) });
    }
  }
  log.info('source.sec.done', { candidates: results.length });
  return results;
}
