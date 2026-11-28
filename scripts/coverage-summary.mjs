// Prints the coverage of every workspace; in GitHub Actions it goes to the job summary.
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageTable } from './lib/coverage-table.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

function readSummaries(group) {
  return readdirSync(join(root, group)).flatMap((name) => {
    const file = join(root, group, name, 'coverage', 'coverage-summary.json');
    if (!existsSync(file)) return [];
    return [{ workspace: `${group}/${name}`, total: JSON.parse(readFileSync(file, 'utf8')).total }];
  });
}

const summaries = ['apps', 'packages', 'tools'].flatMap(readSummaries);
if (summaries.length === 0) {
  console.error('No coverage-summary.json found. Run the tests with coverage first.');
  process.exit(1);
}

const report = `## Test coverage\n\n${coverageTable(summaries)}\n`;
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
else process.stdout.write(report);
