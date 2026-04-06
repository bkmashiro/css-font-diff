import assert from 'node:assert/strict'
import fs from 'node:fs'
import { test } from 'node:test'
import {
  captureSnapshot,
  updateBaselineSnapshots,
  type BrowserTypes,
} from '../src/capture.ts'

// --- Playwright stub factories ---

function makeElement(screenshotFn: (opts: { path: string }) => Promise<void>) {
  return { screenshot: screenshotFn }
}

function makePage({
  gotoFn = async () => {},
  querySelector = async () => null as ReturnType<typeof makeElement> | null,
  pageScreenshotFn = async (_opts: { path: string }) => {},
}: {
  gotoFn?: () => Promise<void>
  querySelector?: () => Promise<ReturnType<typeof makeElement> | null>
  pageScreenshotFn?: (opts: { path: string }) => Promise<void>
}) {
  return {
    goto: gotoFn,
    $: querySelector,
    screenshot: pageScreenshotFn,
  }
}

function makeBrowser(page: ReturnType<typeof makePage>) {
  return {
    newPage: async () => page,
    close: async () => {},
  }
}

function makeBrowserTypes(page: ReturnType<typeof makePage>): BrowserTypes {
  const browserType = { launch: async () => makeBrowser(page) }
  return {
    chromium: browserType,
    firefox: browserType,
    webkit: browserType,
  } as unknown as BrowserTypes
}

// --- Tests ---

test('captureSnapshot returns the output path when the selector matches', async (t) => {
  const elementScreenshot = t.mock.fn(async (_opts: { path: string }) => {})
  const el = makeElement(elementScreenshot)
  const page = makePage({ querySelector: async () => el })
  const browserTypes = makeBrowserTypes(page)

  const result = await captureSnapshot(
    'http://localhost',
    'test',
    '.hero',
    1280,
    'chromium',
    browserTypes
  )

  assert.match(result, /test-chromium\.png$/)
  assert.equal(elementScreenshot.mock.calls.length, 1)
})

test('captureSnapshot falls back to full-page screenshot when selector returns null', async (t) => {
  // Documents the current (buggy) silent-fallback behaviour: when page.$()
  // returns null, captureSnapshot takes a full-page screenshot instead of
  // throwing.  Callers receive no indication the selector was missing.
  const pageScreenshot = t.mock.fn(async (_opts: { path: string }) => {})
  const elementScreenshot = t.mock.fn(async (_opts: { path: string }) => {})
  const page = makePage({
    querySelector: async () => null,
    pageScreenshotFn: pageScreenshot,
  })
  const browserTypes = makeBrowserTypes(page)

  const result = await captureSnapshot(
    'http://localhost',
    'fallback',
    '.nonexistent',
    1280,
    'chromium',
    browserTypes
  )

  // Bug: no error is thrown even though the selector was not found
  assert.match(result, /fallback-chromium\.png$/)
  assert.equal(pageScreenshot.mock.calls.length, 1, 'full-page screenshot taken as fallback')
  assert.equal(elementScreenshot.mock.calls.length, 0, 'element screenshot never called')
})

test('updateBaselineSnapshots iterates over multiple selectors and returns one result each', async (t) => {
  const elementScreenshot = t.mock.fn(async (_opts: { path: string }) => {})
  const el = makeElement(elementScreenshot)
  const page = makePage({ querySelector: async () => el })
  const snapshotsDir = fs.mkdtempSync('/tmp/css-font-diff-capture-')
  const browserTypes = makeBrowserTypes(page)

  const selectors = ['.header', '.footer', '.hero']
  const results = await updateBaselineSnapshots(
    'http://localhost',
    selectors,
    1280,
    snapshotsDir,
    'baseline',
    ['chromium'],
    browserTypes
  )

  assert.equal(results.length, selectors.length)
  assert.equal(
    elementScreenshot.mock.calls.length,
    selectors.length,
    'screenshot called once per selector'
  )

  for (const [i, selector] of selectors.entries()) {
    assert.equal(results[i]?.selector, selector)
    assert.equal(results[i]?.browser, 'chromium')
    assert.match(results[i]?.path ?? '', /baseline/)
  }
})

test('updateBaselineSnapshots spans multiple browsers', async (t) => {
  const elementScreenshot = t.mock.fn(async (_opts: { path: string }) => {})
  const el = makeElement(elementScreenshot)
  const page = makePage({ querySelector: async () => el })
  const snapshotsDir = fs.mkdtempSync('/tmp/css-font-diff-capture-')
  const browserTypes = makeBrowserTypes(page)

  const selectors = ['.title']
  const browsers = ['chromium', 'firefox'] as const
  const results = await updateBaselineSnapshots(
    'http://localhost',
    selectors,
    1280,
    snapshotsDir,
    'baseline',
    [...browsers],
    browserTypes
  )

  assert.equal(results.length, selectors.length * browsers.length)
  assert.equal(
    elementScreenshot.mock.calls.length,
    selectors.length * browsers.length
  )

  const resultBrowsers = results.map((r) => r.browser).sort()
  assert.deepEqual(resultBrowsers, ['chromium', 'firefox'])
})

test('captureSnapshot propagates errors from page.goto', async () => {
  const gotoError = new Error('net::ERR_CONNECTION_REFUSED')
  const page = makePage({ gotoFn: async () => { throw gotoError } })
  const browserTypes = makeBrowserTypes(page)

  await assert.rejects(
    () => captureSnapshot('http://localhost:9999', 'err', 'body', 1280, 'chromium', browserTypes),
    /net::ERR_CONNECTION_REFUSED/
  )
})

test('updateBaselineSnapshots throws when a selector is not found', async () => {
  const page = makePage({ querySelector: async () => null })
  const snapshotsDir = fs.mkdtempSync('/tmp/css-font-diff-capture-')
  const browserTypes = makeBrowserTypes(page)

  await assert.rejects(
    () =>
      updateBaselineSnapshots(
        'http://localhost',
        ['.missing'],
        1280,
        snapshotsDir,
        'baseline',
        ['chromium'],
        browserTypes
      ),
    /Selector not found while updating baselines: \.missing/
  )
})
