import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type Run = { at: string; job: string; status: RunStatus; owner: string | null; error?: string };

const STATUSES: readonly string[] = ['ok', 'retry', 'fail'];

// Parse one log line at the edge; anything that isn't a run is null.
export function parseRun(line: string): Run | null {
  let v: unknown;
  try {
    v = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !STATUSES.includes(o.status as string)) return null;
  if (o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;
  return { at: o.at, job: o.job, status: o.status as RunStatus, owner: o.owner, error: o.error as string | undefined };
}

// Lines stay in file order, so first/last follow the log, not a clock conversion.
export function digest(text: string): { rows: DigestRow[]; badLines: number } {
  const rows = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const run = parseRun(line);
    if (!run) {
      badLines++;
      continue;
    }
    const row = rows.get(run.job);
    if (!row) {
      rows.set(run.job, {
        job: run.job,
        owner: run.owner,
        runs: 1,
        retries: run.status === 'retry' ? 1 : 0,
        lastStatus: run.status,
        lastError: run.error ?? null,
        firstAt: run.at,
        lastAt: run.at,
      });
      continue;
    }
    row.runs++;
    if (run.status === 'retry') row.retries++;
    row.lastStatus = run.status;
    row.lastError = run.error ?? null;
    row.lastAt = run.at;
    row.owner = run.owner ?? row.owner;
  }
  return { rows: [...rows.values()].sort((a, b) => a.job.localeCompare(b.job)), badLines };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  return { night, ...digest(text) };
};
