import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatDiffResults,
  formatDiffStatus,
  formatSummary,
  toJsonDiffResult,
} from '../src/formatter.ts'
import type { RegionDiffResult } from '../src/diff.ts'

test('formatDiffStatus returns passed output when diff is within threshold', () => {
  assert.equal(formatDiffStatus(0.1, 1), '✓ passed')
})

test('formatDiffStatus returns failed output when diff exceeds threshold', () => {
  assert.equal(formatDiffStatus(4.7, 1), '✗ failed (4.7% > 1.0%)')
})

test('toJsonDiffResult returns the expected JSON structure', () => {
  assert.deepEqual(toJsonDiffResult('h1', 4.7, 1), {
    selector: 'h1',
    diff: 4.7,
    threshold: 1,
    passed: false,
  })
})

test('formatSummary shows correct pass and fail counts', () => {
  assert.equal(formatSummary(3, 1), 'Summary: 3 passed, 1 failed')
})

test('formatDiffResults returns the expected fail count and summary', () => {
  const results: RegionDiffResult[] = [
    {
      selector: 'h1',
      diffPercent: 0.1,
      baseline: 'baseline',
      compare: 'compare',
      missing: false,
    },
    {
      selector: 'p',
      diffPercent: 4.7,
      baseline: 'baseline',
      compare: 'compare',
      missing: false,
    },
  ]

  const formatted = formatDiffResults(results, 1)

  assert.equal(formatted.failCount, 1)
  assert.match(formatted.output, /✓ passed/)
  assert.match(formatted.output, /✗ failed \(4\.7% > 1\.0%\)/)
  assert.match(formatted.output, /Summary: 1 passed, 1 failed/)
})
