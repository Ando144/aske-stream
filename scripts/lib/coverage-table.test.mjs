import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coverageTable } from './coverage-table.mjs';

const metric = (pct) => ({ total: 10, covered: 5, skipped: 0, pct });

test('coverageTable shows one row per workspace with one decimal', () => {
  const total = {
    statements: metric(81.25),
    branches: metric(70),
    functions: metric(100),
    lines: metric(0),
  };
  assert.equal(
    coverageTable([{ workspace: 'apps/web', total }]),
    [
      '| Workspace | Statements | Branches | Functions | Lines |',
      '| --- | ---: | ---: | ---: | ---: |',
      '| apps/web | 81.3% | 70.0% | 100.0% | 0.0% |',
    ].join('\n'),
  );
});

test('coverageTable marks missing data as n/a', () => {
  const rows = coverageTable([
    { workspace: 'apps/hub' },
    { workspace: 'tools/ingest', total: { lines: metric('Unknown') } },
  ]).split('\n');
  assert.equal(rows[2], '| apps/hub | n/a | n/a | n/a | n/a |');
  assert.equal(rows[3], '| tools/ingest | n/a | n/a | n/a | n/a |');
});
