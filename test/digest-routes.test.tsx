import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixtures live in a temp dir; runs/ is read-only.
const good = [
  '{"at":"2026-10-29T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"ops"}',
  '{"at":"2026-10-29T02:00:00+01:00","job":"digest/render","status":"ok","owner":null}',
  '{"at":"2026-10-29T03:00:00+01:00","job":"notes/backup","status":"fail","owner":"ops","error":"quota"}',
];
const expectedJobs = ['digest/render', 'lane/sync', 'notes/backup'];

const NIGHT = '2026-10-29';
const EMPTY = '2026-10-30';
const BAD = '2026-10-28';
const MISSING = '2026-10-27';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(dir, `${NIGHT}.jsonl`), good.join('\n') + '\n');
  writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
  // The middle line is cut off mid-object, so it cannot parse.
  writeFileSync(join(dir, `${BAD}.jsonl`), [good[0], '{"at":"2026-10-28T02:00:00+01:00","job":"lane/sy', good[1]].join('\n') + '\n');
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

// Job names in the order the page lists them: the first cell of each body row.
function jobsInHtml(html: string): string[] {
  return [...html.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => m[1]);
}

describe('digest page (HTML)', () => {
  it('serves a night with rows, in job order', async () => {
    const res = await app.request(`/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    expect(jobsInHtml(await res.text())).toEqual(expectedJobs);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no digest for this night');
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('shows the good rows and counts the bad line', async () => {
    const res = await app.request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(jobsInHtml(html)).toEqual(['digest/render', 'lane/sync']);
    expect(html).toContain('1 line could not be read');
  });
});

describe('digest JSON (/api/digest)', () => {
  it('serves a night with rows, in job order, with no bad lines', async () => {
    const res = await app.request(`/api/digest/${NIGHT}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(expectedJobs);
    expect(body.badLines).toBe(0);
  });

  it('returns 404 with an error body for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no such night', night: MISSING });
  });

  it('returns no rows and zero bad lines for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ night: EMPTY, rows: [], badLines: 0 });
  });

  it('counts the bad line and keeps the good rows', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r: { job: string }) => r.job)).toEqual(['digest/render', 'lane/sync']);
  });
});

describe('digest page and JSON agree', () => {
  it('list the same jobs in the same order for the same night', async () => {
    const html = await (await app.request(`/digest/${NIGHT}`)).text();
    const json = await (await app.request(`/api/digest/${NIGHT}`)).json();
    expect(jobsInHtml(html)).toEqual(json.rows.map((r: { job: string }) => r.job));
  });
});
