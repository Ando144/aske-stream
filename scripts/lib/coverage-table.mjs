const METRICS = ['statements', 'branches', 'functions', 'lines'];

// Istanbul reports "Unknown" instead of a number when there is nothing to measure.
const percent = (metric) => (typeof metric?.pct === 'number' ? `${metric.pct.toFixed(1)}%` : 'n/a');

const row = (cells) => `| ${cells.join(' | ')} |`;

/** Markdown table from [{ workspace, total }], `total` as in Vitest's coverage-summary.json. */
export function coverageTable(summaries) {
  return [
    row(['Workspace', 'Statements', 'Branches', 'Functions', 'Lines']),
    row(['---', '---:', '---:', '---:', '---:']),
    ...summaries.map(({ workspace, total }) =>
      row([workspace, ...METRICS.map((name) => percent(total?.[name]))]),
    ),
  ].join('\n');
}
