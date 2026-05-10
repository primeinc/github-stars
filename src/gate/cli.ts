// pnpm gate — single readiness command per issue #69 lesson 1.
//
// Runs each stage sequentially, fails fast, prints a summary table at
// the end. Each stage is a sub-process so it can use whatever toolchain
// (tsc, vitest, schema validator, actionlint) without polluting this
// process.
//
// Stages mirror the issue's spec L70-78:
//   pnpm gate
//     -> typecheck
//     -> test
//     -> validate manifest taxonomy
//     -> validate JSON Schema (manifest against schemas/repos-schema.json)
//     -> verify generated artifacts are fresh
//     -> verify auth-mode resolver fixtures (covered by `test`)
//     -> lint workflow YAML / known workflow footguns

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { validateRegistry } from '../generated/registry.js';

type StageResult = { name: string; ok: boolean; durationMs: number; note?: string };

function runStage(name: string, fn: () => boolean | { ok: boolean; note?: string }): StageResult {
  const t0 = Date.now();
  process.stderr.write(`\n=== gate stage: ${name} ===\n`);
  let ok = false;
  let note: string | undefined;
  try {
    const r = fn();
    if (typeof r === 'boolean') ok = r;
    else { ok = r.ok; note = r.note; }
  } catch (err) {
    ok = false;
    note = (err as Error)?.message ?? String(err);
  }
  const durationMs = Date.now() - t0;
  process.stderr.write(`=== ${name}: ${ok ? 'PASS' : 'FAIL'} (${durationMs}ms)${note ? ` — ${note}` : ''} ===\n`);
  return { name, ok, durationMs, note };
}

function npmRun(script: string): boolean {
  // shell: true so Windows resolves pnpm.cmd via PATH the same way the
  // user's shell does. spawnSync with shell:false skips the .cmd shim.
  const r: SpawnSyncReturns<Buffer> = spawnSync('pnpm', ['run', script], { stdio: 'inherit', shell: true });
  return r.status === 0;
}

function actionlintAvailable(): boolean {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'where' : 'which';
  const r = spawnSync(cmd, ['actionlint'], { stdio: 'pipe', shell: true });
  return r.status === 0;
}

function actionlintAll(): { ok: boolean; note?: string } {
  if (!actionlintAvailable()) {
    return { ok: true, note: 'actionlint not on PATH; skipping (CI installs it)' };
  }
  // Pass files explicitly: actionlint with a directory argument fails on
  // Windows with "Incorrect function" when shell-routed.
  const dir = join('.github', 'workflows');
  if (!existsSync(dir)) return { ok: true, note: 'no workflows dir' };
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join(dir, f));
  if (files.length === 0) return { ok: true, note: 'no workflow files' };
  const r = spawnSync('actionlint', files, { stdio: 'inherit', shell: true });
  return { ok: r.status === 0 };
}

function main(): void {
  const stages: StageResult[] = [];

  stages.push(runStage('typecheck', () => npmRun('typecheck')));
  if (!stages[stages.length - 1].ok) return finish(stages);

  stages.push(runStage('test', () => npmRun('test')));
  if (!stages[stages.length - 1].ok) return finish(stages);

  stages.push(runStage('validate (taxonomy + schema)', () => npmRun('validate')));
  if (!stages[stages.length - 1].ok) return finish(stages);

  stages.push(
    runStage('generated-artifacts registry', () => {
      const r = validateRegistry(existsSync);
      return { ok: r.ok, note: r.ok ? undefined : `missing: ${r.missing.join(', ')}` };
    })
  );
  if (!stages[stages.length - 1].ok) return finish(stages);

  stages.push(runStage('actionlint (workflow YAML)', () => actionlintAll()));

  finish(stages);
}

function finish(stages: StageResult[]): void {
  const totalMs = stages.reduce((acc, s) => acc + s.durationMs, 0);
  const allOk = stages.every((s) => s.ok);
  process.stderr.write('\n=== gate summary ===\n');
  for (const s of stages) {
    process.stderr.write(`  ${s.ok ? 'PASS' : 'FAIL'}  ${s.name.padEnd(36)} ${String(s.durationMs).padStart(6)}ms${s.note ? `  — ${s.note}` : ''}\n`);
  }
  process.stderr.write(`  ----  ${'total'.padEnd(36)} ${String(totalMs).padStart(6)}ms\n`);
  process.stderr.write(`gate: ${allOk ? 'PASS' : 'FAIL'}\n`);
  process.exit(allOk ? 0 : 1);
}

main();
