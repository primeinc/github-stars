// $GITHUB_STEP_SUMMARY writer.
// Workflow steps call appendSummary(...) to add evidence-labeled lines.

import { appendFileSync, existsSync } from 'node:fs';
import process from 'node:process';

export function appendSummary(markdown: string): void {
  const target = process.env.GITHUB_STEP_SUMMARY;
  if (!target) return;
  if (!existsSync(target)) return;
  appendFileSync(target, markdown + '\n');
}

export function summaryHeading(level: number, text: string): string {
  const hashes = '#'.repeat(Math.min(Math.max(level, 1), 6));
  return `${hashes} ${text}`;
}

export function summaryTable(rows: ReadonlyArray<ReadonlyArray<string>>): string {
  if (rows.length === 0) return '';
  const [header, ...body] = rows;
  const sep = header.map(() => '---');
  const fmt = (r: ReadonlyArray<string>) => `| ${r.join(' | ')} |`;
  return [fmt(header), fmt(sep), ...body.map(fmt)].join('\n');
}
