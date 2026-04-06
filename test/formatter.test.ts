import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatBaselineUpdateDone,
  formatCaptureDone,
  formatDiffResults,
  formatDiffStatus,
  formatMultiBrowserReport,
  formatSummary,
  toJsonDiffResult,
} from '../src/formatter.ts'
import type { MultiBrowserDiffResult, RegionDiffResult } from '../src/diff.ts'

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

test('toJsonDiffResult marks results as passed at the threshold boundary', () => {
  assert.deepEqual(toJsonDiffResult('p', 1, 1), {
    selector: 'p',
    diff: 1,
    threshold: 1,
    passed: true,
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

test('formatDiffResults includes missing snapshots and green summary when everything passes', () => {
  const results: RegionDiffResult[] = [
    {
      selector: '.hero-title',
      diffPercent: 0,
      baseline: 'baseline',
      compare: 'compare',
      missing: true,
    },
    {
      selector: 'span',
      diffPercent: 0.5,
      baseline: 'baseline',
      compare: 'compare',
      missing: false,
    },
  ]

  const formatted = formatDiffResults(results, 1)

  assert.equal(formatted.failCount, 0)
  assert.match(formatted.output, /Comparing font regions\.\.\./)
  assert.match(formatted.output, /\.hero-title/)
  assert.match(formatted.output, /snapshot not found/)
  assert.match(formatted.output, /Summary: 1 passed, 0 failed/)
})

test('formatCaptureDone reports the saved snapshot path', () => {
  assert.equal(formatCaptureDone('snapshots/demo-chromium.png'), 'Snapshot saved: snapshots/demo-chromium.png')
})

test('formatMultiBrowserReport includes header and separator', () => {
  const results: MultiBrowserDiffResult[] = []
  const output = formatMultiBrowserReport(results, 1, ['chromium'])

  assert.match(output, /Multi-browser font diff report/)
  assert.match(output, /Selector/)
  assert.match(output, /Chromium/)
})

test('formatMultiBrowserReport shows pass counts for all-passing results', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h1',
      browsers: {
        chromium: { diffPercent: 0, missing: false },
        firefox: { diffPercent: 0.5, missing: false },
        webkit: { diffPercent: 0, missing: false },
      },
    },
  ]
  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /3 passed, 0 failed/)
})

test('formatMultiBrowserReport counts failures correctly', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'p',
      browsers: {
        chromium: { diffPercent: 5, missing: false },
        firefox: { diffPercent: 0.1, missing: false },
        webkit: { diffPercent: 0, missing: false },
      },
    },
  ]
  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  // chromium fails (5% > 1%), firefox and webkit pass
  assert.match(output, /2 passed, 1 failed/)
})

test('formatMultiBrowserReport shows missing indicator for absent snapshots', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: '.nav',
      browsers: {
        chromium: { diffPercent: 0, missing: true },
        firefox: { diffPercent: 0, missing: false },
        webkit: { diffPercent: 0, missing: false },
      },
    },
  ]
  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /\? missing/)
})

test('formatMultiBrowserReport includes browser column headers', () => {
  const results: MultiBrowserDiffResult[] = []
  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /Firefox/)
  assert.match(output, /WebKit/)
})

test('formatMultiBrowserReport summary shows browser count', () => {
  const results: MultiBrowserDiffResult[] = []
  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox'])

  assert.match(output, /across 2 browsers/)
})

test('formatBaselineUpdateDone reports updated selectors and count', () => {
  const output = formatBaselineUpdateDone([
    { selector: '.hero-title', path: 'snapshots/baseline-_hero-title-chromium.png', browser: 'chromium' },
    { selector: '.body-text', path: 'snapshots/baseline-_body-text-chromium.png', browser: 'chromium' },
  ])

  assert.match(output, /Updating baselines\.\.\./)
  assert.match(output, /\.hero-title -> snapshots\/baseline-_hero-title-chromium\.png updated/)
  assert.match(output, /2 baselines updated\./)
})
