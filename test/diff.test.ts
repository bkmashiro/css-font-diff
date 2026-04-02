import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { PNG } from 'pngjs'
import { diffImages, snapshotPath } from '../src/diff.ts'

const fixturesDir = path.join(process.cwd(), 'test', 'fixtures')
const imgA = path.join(fixturesDir, 'img-a.png')
const imgB = path.join(fixturesDir, 'img-b.png')
const imgC = path.join(fixturesDir, 'img-c.png')

test('diffImages returns 0 for identical images', () => {
  assert.equal(diffImages(imgA, imgC), 0)
})

test('diffImages returns a small non-zero percent for one changed pixel', () => {
  const diff = diffImages(imgA, imgB)

  assert.ok(diff > 0)
  assert.ok(diff < 5)
})

test('diffImages throws a helpful error when dimensions differ', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-font-diff-'))
  const imgDifferentSize = path.join(tempDir, 'img-different-size.png')
  const png = new PNG({ width: 5, height: 10 })

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 255
    png.data[i + 3] = 255
  }

  fs.writeFileSync(imgDifferentSize, PNG.sync.write(png))

  assert.throws(
    () => diffImages(imgA, imgDifferentSize),
    /Image dimensions do not match: 10x10 vs 5x10/
  )
})

test('diffImages always returns a number between 0 and 100', () => {
  const diff = diffImages(imgA, imgB)

  assert.equal(typeof diff, 'number')
  assert.ok(diff >= 0)
  assert.ok(diff <= 100)
})

test('snapshotPath returns the expected snapshots filename', () => {
  assert.equal(snapshotPath('baseline'), path.join('snapshots', 'baseline-chromium.png'))
})
