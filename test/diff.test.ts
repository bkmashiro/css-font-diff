import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { diffImages, diffSnapshots, diffSnapshotsAllBrowsers, safeSelector, snapshotPath } from '../src/diff.ts'

const tmpDir = '/tmp/css-font-diff-test'
fs.mkdirSync(tmpDir, { recursive: true })

function makePNG(
  filePath: string,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): void {
  const png = new PNG({ width, height })

  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r
    png.data[i * 4 + 1] = g
    png.data[i * 4 + 2] = b
    png.data[i * 4 + 3] = 255
  }

  fs.writeFileSync(filePath, PNG.sync.write(png))
}

const imgA = path.join(tmpDir, 'a.png')
const imgB = path.join(tmpDir, 'b.png')
const imgC = path.join(tmpDir, 'c.png')
const imgD = path.join(tmpDir, 'd.png')

makePNG(imgA, 10, 10, 255, 0, 0)
makePNG(imgB, 10, 10, 255, 0, 0)
makePNG(imgC, 10, 10, 255, 0, 0)
makePNG(imgD, 20, 10, 255, 0, 0)

// Change one pixel so the image differs by exactly 1%.
{
  const png = PNG.sync.read(fs.readFileSync(imgC))
  png.data[0] = 0
  png.data[1] = 0
  png.data[2] = 255
  fs.writeFileSync(imgC, PNG.sync.write(png))
}

test('diffImages returns 0 for two identical 10x10 PNGs', () => {
  assert.equal(diffImages(imgA, imgB), 0)
})

test('diffImages returns a small non-zero percent for one changed pixel', () => {
  const diff = diffImages(imgA, imgC)

  assert.ok(diff > 0)
  assert.ok(diff < 5)
})

test('diffImages throws a helpful error when dimensions differ', () => {
  assert.throws(
    () => diffImages(imgA, imgD),
    /Image dimensions do not match: 10x10 vs 20x10/
  )
})

test('diffImages always returns a number between 0 and 100', () => {
  const diff = diffImages(imgA, imgC)

  assert.equal(typeof diff, 'number')
  assert.ok(diff >= 0)
  assert.ok(diff <= 100)
})

test('snapshotPath returns the expected snapshots filename', () => {
  assert.equal(snapshotPath('foo'), path.join('snapshots', 'foo-chromium.png'))
})

test('safeSelector replaces non-alphanumeric chars and appends a 6-char hash', () => {
  const result = safeSelector('.hero > h1')
  assert.match(result, /^[a-zA-Z0-9_-]+_[0-9a-f]{6}$/)
})

test('safeSelector is deterministic for the same input', () => {
  assert.equal(safeSelector('.hero > h1'), safeSelector('.hero > h1'))
})

test('safeSelector produces distinct outputs for visually similar selectors', () => {
  // Both sanitize to the same string without hashing — the hash must differentiate them
  const a = safeSelector('.hero > h1')
  const b = safeSelector('.hero_h1')
  assert.notEqual(a, b)
})

test('safeSelector handles selectors that are already alphanumeric', () => {
  const result = safeSelector('main')
  assert.match(result, /^main_[0-9a-f]{6}$/)
})

test('safeSelector handles empty string', () => {
  const result = safeSelector('')
  assert.match(result, /^_[0-9a-f]{6}$/)
})

test('diffSnapshots returns a diff result for existing selector snapshots', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.title'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `baseline-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `compare-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgC))

  const [result] = diffSnapshots('baseline', 'compare', [selector], 0.1)

  assert.deepEqual(result, {
    selector,
    diffPercent: 1,
    baseline: path.join('snapshots', `baseline-${safe}-chromium.png`),
    compare: path.join('snapshots', `compare-${safe}-chromium.png`),
    missing: false,
    browser: 'chromium',
  })
})

test('diffSnapshots marks selectors as missing when either snapshot is absent', () => {
  const selector = '#hero'
  const safe = safeSelector(selector)
  const [result] = diffSnapshots('missing-baseline', 'missing-compare', [selector], 0.1)

  assert.deepEqual(result, {
    selector,
    diffPercent: 0,
    baseline: path.join('snapshots', `missing-baseline-${safe}-chromium.png`),
    compare: path.join('snapshots', `missing-compare-${safe}-chromium.png`),
    missing: true,
    browser: 'chromium',
  })
})

test('diffSnapshots marks selectors as missing and includes error when image comparison throws', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = 'main > h1'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `broken-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `broken-compare-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgD))

  const [result] = diffSnapshots('broken', 'broken-compare', [selector], 0.1)

  assert.equal(result.selector, selector)
  assert.equal(result.diffPercent, 0)
  assert.equal(result.missing, true)
  assert.ok(result.error, 'expected error to be populated')
  assert.match(result.error!, /10x10.*20x10|20x10.*10x10/)
})

test('diffSnapshots result has no error field on success', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.no-error'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `noerr-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `noerr-compare-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgB))

  const [result] = diffSnapshots('noerr', 'noerr-compare', [selector], 0.1)

  assert.equal(result.missing, false)
  assert.equal(result.error, undefined)
})

test('diffSnapshotsAllBrowsers includes error when dimensions mismatch', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.multi-broken'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `mbase-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `mcompare-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgD))

  const [result] = diffSnapshotsAllBrowsers('mbase', 'mcompare', [selector], 0.1, ['chromium'])
  const chromium = result.browsers['chromium']

  assert.equal(chromium.missing, true)
  assert.equal(chromium.diffPercent, 0)
  assert.ok(chromium.error, 'expected error to be populated')
  assert.match(chromium.error!, /10x10.*20x10|20x10.*10x10/)
})

test('diffSnapshotsAllBrowsers has no error field on success', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.multi-ok'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `mok-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `mok-compare-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgB))

  const [result] = diffSnapshotsAllBrowsers('mok', 'mok-compare', [selector], 0.1, ['chromium'])
  const chromium = result.browsers['chromium']

  assert.equal(chromium.missing, false)
  assert.equal(chromium.error, undefined)
})

test('diffSnapshots uses custom snapshotsDir instead of hardcoded snapshots/', () => {
  const customDir = path.join(tmpDir, 'custom-snaps')
  fs.mkdirSync(customDir, { recursive: true })

  const selector = 'p'
  const safe = safeSelector(selector)
  const baselinePath = path.join(customDir, `custom-base-${safe}-chromium.png`)
  const comparePath = path.join(customDir, `custom-cmp-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgA))

  const [result] = diffSnapshots('custom-base', 'custom-cmp', [selector], 0.1, 'chromium', customDir)

  assert.equal(result.missing, false)
  assert.equal(result.diffPercent, 0)
  assert.equal(result.baseline, path.join(customDir, `custom-base-${safe}-chromium.png`))
})

test('diffSnapshots with custom snapshotsDir treats missing files as missing', () => {
  const customDir = path.join(tmpDir, 'custom-snaps-missing')

  const [result] = diffSnapshots('no-base', 'no-cmp', ['h1'], 0.1, 'chromium', customDir)

  assert.equal(result.missing, true)
  assert.equal(result.diffPercent, 0)
  assert.ok(result.baseline.startsWith(customDir))
})

test('diffSnapshotsAllBrowsers uses custom snapshotsDir for all browsers', () => {
  const customDir = path.join(tmpDir, 'multi-browser-snaps')
  fs.mkdirSync(customDir, { recursive: true })

  const selector = 'h2'
  const safe = safeSelector(selector)

  for (const browser of ['chromium', 'firefox'] as const) {
    const baselinePath = path.join(customDir, `mb-base-${safe}-${browser}.png`)
    const comparePath = path.join(customDir, `mb-cmp-${safe}-${browser}.png`)
    fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
    fs.writeFileSync(comparePath, fs.readFileSync(imgA))
  }

  const [result] = diffSnapshotsAllBrowsers(
    'mb-base',
    'mb-cmp',
    [selector],
    0.1,
    ['chromium', 'firefox'],
    customDir
  )

  assert.equal(result.selector, selector)
  assert.equal(result.browsers.chromium.missing, false)
  assert.equal(result.browsers.chromium.diffPercent, 0)
  assert.equal(result.browsers.firefox.missing, false)
  assert.equal(result.browsers.firefox.diffPercent, 0)
})

test('diffSnapshotsAllBrowsers marks browsers as missing when snapshotsDir has no files', () => {
  const emptyDir = path.join(tmpDir, 'empty-snaps')

  const [result] = diffSnapshotsAllBrowsers(
    'ghost-base',
    'ghost-cmp',
    ['span'],
    0.1,
    ['chromium', 'webkit'],
    emptyDir
  )

  assert.equal(result.browsers.chromium.missing, true)
  assert.equal(result.browsers.webkit.missing, true)
})

test('diffSnapshotsAllBrowsers defaults to snapshots/ when snapshotsDir is omitted', () => {
  // Verifies the default parameter matches the pre-existing hardcoded behaviour.
  const [result] = diffSnapshotsAllBrowsers(
    'ghost-default',
    'ghost-default-cmp',
    ['#nonexistent'],
    0.1,
    ['chromium']
  )

  assert.equal(result.browsers.chromium.missing, true)
  assert.ok(result.selector === '#nonexistent')
})

test('diffSnapshots re-throws unexpected errors (non-dimension errors)', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.corrupt'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `corrupt-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `corrupt-compare-${safe}-chromium.png`)

  // Write invalid PNG data to trigger a parse error
  fs.writeFileSync(baselinePath, Buffer.from('not a png'))
  fs.writeFileSync(comparePath, Buffer.from('not a png'))

  assert.throws(
    () => diffSnapshots('corrupt', 'corrupt-compare', [selector], 0.1),
    (err) => err instanceof Error && !err.message.startsWith('Image dimensions do not match')
  )
})

test('diffSnapshotsAllBrowsers marks missing: true for dimension mismatch', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.resized'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `mbase-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `mcomp-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgD))

  const [result] = diffSnapshotsAllBrowsers('mbase', 'mcomp', [selector], 0.1, ['chromium'])

  assert.deepEqual(result.browsers.chromium, { diffPercent: 0, missing: true, error: result.browsers.chromium.error })
  assert.equal(result.browsers.chromium.missing, true)
})

test('diffSnapshotsAllBrowsers re-throws unexpected errors', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.bad'
  const safe = safeSelector(selector)
  const baselinePath = path.join(snapshotsDir, `badbase-${safe}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `badcomp-${safe}-chromium.png`)

  fs.writeFileSync(baselinePath, Buffer.from('not a png'))
  fs.writeFileSync(comparePath, Buffer.from('not a png'))

  assert.throws(
    () => diffSnapshotsAllBrowsers('badbase', 'badcomp', [selector], 0.1, ['chromium']),
    (err) => err instanceof Error && !err.message.startsWith('Image dimensions do not match')
  )
})
