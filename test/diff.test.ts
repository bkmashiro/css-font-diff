import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { diffImages, diffSnapshots, diffSnapshotsAllBrowsers, snapshotPath } from '../src/diff.ts'

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

test('diffSnapshots returns a diff result for existing selector snapshots', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = '.title'
  const safeSelector = '_title'
  const baselinePath = path.join(snapshotsDir, `baseline-${safeSelector}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `compare-${safeSelector}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgC))

  const [result] = diffSnapshots('baseline', 'compare', [selector], 0.1)

  assert.deepEqual(result, {
    selector,
    diffPercent: 1,
    baseline: path.join('snapshots', `baseline-${safeSelector}-chromium.png`),
    compare: path.join('snapshots', `compare-${safeSelector}-chromium.png`),
    missing: false,
    browser: 'chromium',
  })
})

test('diffSnapshots marks selectors as missing when either snapshot is absent', () => {
  const [result] = diffSnapshots('missing-baseline', 'missing-compare', ['#hero'], 0.1)

  assert.deepEqual(result, {
    selector: '#hero',
    diffPercent: 0,
    baseline: path.join('snapshots', 'missing-baseline-_hero-chromium.png'),
    compare: path.join('snapshots', 'missing-compare-_hero-chromium.png'),
    missing: true,
    browser: 'chromium',
  })
})

test('diffSnapshots marks selectors as missing when image comparison throws', () => {
  const snapshotsDir = path.join(process.cwd(), 'snapshots')
  fs.mkdirSync(snapshotsDir, { recursive: true })

  const selector = 'main > h1'
  const safeSelector = 'main___h1'
  const baselinePath = path.join(snapshotsDir, `broken-${safeSelector}-chromium.png`)
  const comparePath = path.join(snapshotsDir, `broken-compare-${safeSelector}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgD))

  const [result] = diffSnapshots('broken', 'broken-compare', [selector], 0.1)

  assert.deepEqual(result, {
    selector,
    diffPercent: 0,
    baseline: path.join('snapshots', `broken-${safeSelector}-chromium.png`),
    compare: path.join('snapshots', `broken-compare-${safeSelector}-chromium.png`),
    missing: true,
    browser: 'chromium',
  })
})

test('diffSnapshots uses custom snapshotsDir instead of hardcoded snapshots/', () => {
  const customDir = path.join(tmpDir, 'custom-snaps')
  fs.mkdirSync(customDir, { recursive: true })

  const selector = 'p'
  const safeSelector = 'p'
  const baselinePath = path.join(customDir, `custom-base-${safeSelector}-chromium.png`)
  const comparePath = path.join(customDir, `custom-cmp-${safeSelector}-chromium.png`)

  fs.writeFileSync(baselinePath, fs.readFileSync(imgA))
  fs.writeFileSync(comparePath, fs.readFileSync(imgA))

  const [result] = diffSnapshots('custom-base', 'custom-cmp', [selector], 0.1, 'chromium', customDir)

  assert.equal(result.missing, false)
  assert.equal(result.diffPercent, 0)
  assert.equal(result.baseline, path.join(customDir, `custom-base-${safeSelector}-chromium.png`))
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
  const safeSelector = 'h2'

  for (const browser of ['chromium', 'firefox'] as const) {
    const baselinePath = path.join(customDir, `mb-base-${safeSelector}-${browser}.png`)
    const comparePath = path.join(customDir, `mb-cmp-${safeSelector}-${browser}.png`)
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
