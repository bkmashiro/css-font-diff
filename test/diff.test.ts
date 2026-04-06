import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { diffImages, diffSnapshots, safeSelector, snapshotPath } from '../src/diff.ts'

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

test('safeSelector replaces dots with underscores', () => {
  assert.equal(safeSelector('.title'), '_title')
})

test('safeSelector replaces colons and parens in pseudo-selectors', () => {
  assert.equal(safeSelector(':not(.class)'), '_not__class_')
})

test('safeSelector replaces brackets and special chars in attribute selectors', () => {
  assert.equal(safeSelector('[data-attr]'), '_data-attr_')
})

test('safeSelector replaces double colons in pseudo-elements', () => {
  assert.equal(safeSelector('::before'), '__before')
})

test('safeSelector replaces spaces and combinators', () => {
  assert.equal(safeSelector('main > h1'), 'main___h1')
})

test('safeSelector preserves hyphens and underscores', () => {
  assert.equal(safeSelector('my-class_name'), 'my-class_name')
})

test('safeSelector preserves alphanumeric characters', () => {
  assert.equal(safeSelector('h1'), 'h1')
})

test('safeSelector replaces unicode characters', () => {
  assert.equal(safeSelector('héllo'), 'h_llo')
})

test('safeSelector handles empty string', () => {
  assert.equal(safeSelector(''), '')
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
