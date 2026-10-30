import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRun } from './read.js';
import type { RunStatus } from './types.js';

export type StatusCounts = Record<RunStatus, number>;

// Count run lines by status. Unparseable lines are skipped.
export function countRuns(text: string): StatusCounts {
  const counts: StatusCounts = { ok: 0, retry: 0, fail: 0 };
  for (const line of text.split('\n')) {
    const run = line.trim() === '' ? null : parseRun(line);
    if (run) counts[run.status]++;
  }
  return counts;
}

// null when the night file cannot be read.
export function readCounts(runsDir: string, night: string): StatusCounts | null {
  try {
    return countRuns(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
