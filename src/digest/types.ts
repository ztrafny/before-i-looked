// Plan morning-digest § 1. The contract every § 2 part builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One job across a night. Times keep the log's offset; owner is null when the log has none.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type Night = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse as a run. Counted, never thrown.
  badLines: number;
};

// null when runs/<night>.jsonl does not exist. Rows are sorted by job.
export type ReadNight = (runsDir: string, night: string) => Night | null;
