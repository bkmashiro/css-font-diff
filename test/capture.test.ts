import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, mock, beforeEach, afterEach } from 'node:test'

// ---------------------------------------------------------------------------
// Configurable state that each test can override before exercising the module.
// We use a shared mutable object because mock.module() only works once per
// specifier per test file — the mock is set up at module load time and the
// tests drive behaviour by mutating this state.
// ---------------------------------------------------------------------------

const state = {
  gotoError: null as Error | null,
  /** null → element not found, otherwise the handle is returned */
  elementHandle: null as { screenshot: (opts: { path: string }) => Promise<void> } | null,
  /** tracks close() calls per browser (indexed by browser launch order) */
  browserCloseCalls: [] as boolean[],
  /** tracks which browser names were launched */
  launchedBrowserNames: [] as string[],
  /** per-browser element handle overrides (keyed by browser name) */
  elementHandleByBrowser: null as Record<string, { screenshot: (opts: { path: string }) => Promise<void> } | null> | null,
}

function resetState() {
  state.gotoError = null
  state.elementHandle = null
  state.browserCloseCalls = []
  state.launchedBrowserNames = []
  state.elementHandleByBrowser = null
}

function makeBrowserForName(name: string) {
  const closeIndex = state.browserCloseCalls.length
  state.browserCloseCalls.push(false)

  return {
    newPage: async (_opts: unknown) => ({
      goto: async () => {
        if (state.gotoError) throw state.gotoError
      },
      $: async (_selector: string) => {
        if (state.elementHandleByBrowser) {
          return state.elementHandleByBrowser[name] ?? null
        }
        return state.elementHandle
      },
      screenshot: async (opts: { path: string }) => {
        fs.mkdirSync(path.dirname(opts.path), { recursive: true })
        fs.writeFileSync(opts.path, Buffer.from('full-page'))
      },
    }),
    close: async () => {
      state.browserCloseCalls[closeIndex] = true
    },
  }
}

// Set up the module mock once. Each browser type delegates to makeBrowserForName
// so that per-test state changes are picked up at call time.
mock.module('playwright', {
  namedExports: {
    chromium: {
      launch: async () => {
        state.launchedBrowserNames.push('chromium')
        return makeBrowserForName('chromium')
      },
    },
    firefox: {
      launch: async () => {
        state.launchedBrowserNames.push('firefox')
        return makeBrowserForName('firefox')
      },
    },
    webkit: {
      launch: async () => {
        state.launchedBrowserNames.push('webkit')
        return makeBrowserForName('webkit')
      },
    },
  },
})

// Import the module under test AFTER the mock is registered so it picks up
// the mocked playwright. Use a dynamic import to guarantee load order.
const { captureSnapshot, updateBaselineSnapshots } = await import('../src/capture.ts')

let tmpDir: string

beforeEach(() => {
  resetState()
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-test-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// captureSnapshot() — happy path
// ---------------------------------------------------------------------------

test('captureSnapshot() writes a PNG file and returns its path when the element is found', async () => {
  let elementScreenshotPath: string | undefined

  state.elementHandle = {
    screenshot: async (opts: { path: string }) => {
      elementScreenshotPath = opts.path
      fs.mkdirSync(path.dirname(opts.path), { recursive: true })
      fs.writeFileSync(opts.path, Buffer.from('element-png'))
    },
  }

  const outPath = await captureSnapshot('http://localhost', 'happy', '.hero', 1280, 'chromium')

  assert.ok(elementScreenshotPath, 'element.screenshot() should have been called')
  assert.equal(outPath, elementScreenshotPath)
  assert.match(outPath, /happy-chromium\.png$/)
  assert.ok(fs.existsSync(outPath), 'output file should exist on disk')
})

// ---------------------------------------------------------------------------
// captureSnapshot() — browser.close() on goto error
// ---------------------------------------------------------------------------

test('captureSnapshot() closes the browser when page.goto() throws', async () => {
  state.gotoError = new Error('network timeout')

  await assert.rejects(
    () => captureSnapshot('http://localhost', 'snap', 'body', 1280),
    /network timeout/
  )

  // The try/finally ensures browser.close() is called even when goto throws.
  assert.equal(
    state.browserCloseCalls[0],
    true,
    'browser should be closed in finally block even when goto throws'
  )
})

// ---------------------------------------------------------------------------
// captureSnapshot() — selector fallback
// ---------------------------------------------------------------------------

test('captureSnapshot() falls back to full-page screenshot when the element is not found', async () => {
  // null signals "element not found"
  state.elementHandle = null

  // We can't easily intercept page.screenshot from here because makeBrowserForName
  // creates it inline. Instead we verify the output file contents, which the
  // full-page mock writes as 'full-page'.
  const outPath = await captureSnapshot('http://localhost', 'fallback', '.nonexistent', 1280)

  assert.match(outPath, /fallback-chromium\.png$/)

  assert.ok(fs.existsSync(outPath), 'output file should exist')
  const contents = fs.readFileSync(outPath)
  assert.equal(contents.toString(), 'full-page', 'full-page screenshot content should be written')
})

// ---------------------------------------------------------------------------
// updateBaselineSnapshots() — iterates over all configured browsers
// ---------------------------------------------------------------------------

test('updateBaselineSnapshots() launches every configured browser and returns one result per browser', async () => {
  state.elementHandleByBrowser = {
    chromium: {
      screenshot: async (opts: { path: string }) => {
        fs.mkdirSync(path.dirname(opts.path), { recursive: true })
        fs.writeFileSync(opts.path, Buffer.from('chromium'))
      },
    },
    firefox: {
      screenshot: async (opts: { path: string }) => {
        fs.mkdirSync(path.dirname(opts.path), { recursive: true })
        fs.writeFileSync(opts.path, Buffer.from('firefox'))
      },
    },
    webkit: {
      screenshot: async (opts: { path: string }) => {
        fs.mkdirSync(path.dirname(opts.path), { recursive: true })
        fs.writeFileSync(opts.path, Buffer.from('webkit'))
      },
    },
  }

  const results = await updateBaselineSnapshots(
    'http://localhost',
    ['.hero'],
    1280,
    tmpDir,
    'baseline',
    ['chromium', 'firefox', 'webkit']
  )

  assert.deepEqual(
    state.launchedBrowserNames.sort(),
    ['chromium', 'firefox', 'webkit'],
    'all three browsers should be launched'
  )
  assert.equal(results.length, 3, 'one result per browser')
  assert.deepEqual(
    results.map((r) => r.browser).sort(),
    ['chromium', 'firefox', 'webkit']
  )
  assert.ok(
    results.every((r) => r.selector === '.hero'),
    'each result should carry the requested selector'
  )
})

// ---------------------------------------------------------------------------
// updateBaselineSnapshots() — missing selector
// ---------------------------------------------------------------------------

test('updateBaselineSnapshots() throws when a selector is not found in the page', async () => {
  state.elementHandle = null // element not found

  await assert.rejects(
    () =>
      updateBaselineSnapshots(
        'http://localhost',
        ['.missing'],
        1280,
        tmpDir,
        'baseline',
        ['chromium']
      ),
    /Selector not found: \.missing/
  )
})
