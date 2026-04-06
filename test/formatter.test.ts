import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatBaselineUpdateDone,
  formatCaptureDone,
  formatDiffResults,
  formatDiffStatus,
  formatMultiBrowserReport,
  formatSummary,
} from '../src/formatter.ts'
import type { MultiBrowserDiffResult, RegionDiffResult } from '../src/diff.ts'

test('formatDiffStatus returns passed output when diff is within threshold', () => {
  assert.equal(formatDiffStatus(0.1, 1), '✓ passed')
})

test('formatDiffStatus returns failed output when diff exceeds threshold', () => {
  assert.equal(formatDiffStatus(4.7, 1), '✗ failed (4.7% > 1.0%)')
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

test('formatMultiBrowserReport includes header and selector rows', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h1',
      browsers: {
        chromium: { diffPercent: 0.5, missing: false },
        firefox: { diffPercent: 2.3, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
    {
      selector: 'p',
      browsers: {
        chromium: { diffPercent: 0.0, missing: false },
        firefox: { diffPercent: 0.1, missing: false },
        webkit: { diffPercent: 5.0, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /Multi-browser font diff report/)
  assert.match(output, /Selector/)
  assert.match(output, /Chromium/)
  assert.match(output, /Firefox/)
  assert.match(output, /WebKit/)
  assert.match(output, /Title \(h1\)/)
  assert.match(output, /Body text \(p\)/)
  // firefox 2.3% and webkit 5.0% exceed threshold of 1 — 2 failures
  assert.match(output, /Summary: 4 passed, 2 failed/)
})

test('formatMultiBrowserReport shows missing when a browser key is absent', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h1',
      browsers: {
        chromium: { diffPercent: 0.5, missing: false },
        // firefox and webkit intentionally omitted
      } as MultiBrowserDiffResult['browsers'],
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /\? missing/)
})

test('formatMultiBrowserReport shows missing when browser entry has missing flag', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'p',
      browsers: {
        chromium: { diffPercent: 0, missing: true },
        firefox: { diffPercent: 0, missing: true },
        webkit: { diffPercent: 0, missing: true },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /\? missing/)
  assert.match(output, /Summary: 0 passed, 0 failed/)
})

test('formatMultiBrowserReport shows all-pass summary when nothing exceeds threshold', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'a',
      browsers: {
        chromium: { diffPercent: 0.1, missing: false },
        firefox: { diffPercent: 0.2, missing: false },
        webkit: { diffPercent: 0.3, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /Summary: 3 passed, 0 failed/)
})

test('formatBaselineUpdateDone reports updated selectors and count', () => {
  const output = formatBaselineUpdateDone([
    { selector: '.hero-title', path: 'snapshots/baseline-_hero-title-chromium.png', browser: 'chromium' as const },
    { selector: '.body-text', path: 'snapshots/baseline-_body-text-chromium.png', browser: 'chromium' as const },
  ])

  assert.match(output, /Updating baselines\.\.\./)
  assert.match(output, /\.hero-title -> snapshots\/baseline-_hero-title-chromium\.png updated/)
  assert.match(output, /2 baselines updated\./)
})

test('formatMultiBrowserReport shows pass summary when all selectors match across all browsers', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h1',
      browsers: {
        chromium: { diffPercent: 0.1, missing: false },
        firefox: { diffPercent: 0.2, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
    {
      selector: 'p',
      browsers: {
        chromium: { diffPercent: 0.5, missing: false },
        firefox: { diffPercent: 0.3, missing: false },
        webkit: { diffPercent: 0.4, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /Multi-browser font diff report/)
  assert.match(output, /Title \(h1\)/)
  assert.match(output, /Body text \(p\)/)
  assert.match(output, /✓/)
  assert.doesNotMatch(output, /✗/)
  assert.match(output, /6 passed, 0 failed/)
})

test('formatMultiBrowserReport shows fail summary when some selectors differ across browsers', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h1',
      browsers: {
        chromium: { diffPercent: 0.1, missing: false },
        firefox: { diffPercent: 5.0, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
    {
      selector: 'p',
      browsers: {
        chromium: { diffPercent: 0.2, missing: false },
        firefox: { diffPercent: 0.3, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox'])

  assert.match(output, /✗ 5\.0%/)
  assert.match(output, /✓ 0\.1%/)
  assert.match(output, /3 passed, 1 failed/)
})

test('formatMultiBrowserReport shows missing marker for absent snapshots', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'a',
      browsers: {
        chromium: { diffPercent: 0, missing: true },
        firefox: { diffPercent: 0.1, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox'])

  assert.match(output, /\? missing/)
  assert.match(output, /✓ 0\.1%/)
  assert.match(output, /1 passed, 0 failed/)
})

test('formatMultiBrowserReport uses raw selector when no label mapping exists', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: '.custom-class',
      browsers: {
        chromium: { diffPercent: 0.0, missing: false },
        firefox: { diffPercent: 0.0, missing: false },
        webkit: { diffPercent: 0.0, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium'])

  assert.match(output, /\.custom-class/)
})

test('formatMultiBrowserReport counts each browser result independently when threshold is exceeded', () => {
  const results: MultiBrowserDiffResult[] = [
    {
      selector: 'h2',
      browsers: {
        chromium: { diffPercent: 3.0, missing: false },
        firefox: { diffPercent: 3.0, missing: false },
        webkit: { diffPercent: 3.0, missing: false },
      },
    },
  ]

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox', 'webkit'])

  assert.match(output, /0 passed, 3 failed/)
})

test('formatMultiBrowserReport renders correct browser header columns', () => {
  const results: MultiBrowserDiffResult[] = []

  const output = formatMultiBrowserReport(results, 1, ['chromium', 'firefox'])

  assert.match(output, /Chromium/)
  assert.match(output, /Firefox/)
  assert.doesNotMatch(output, /WebKit/)
})
