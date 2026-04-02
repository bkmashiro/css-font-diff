import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

function createSolidPNG(width: number, height: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width, height })

  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r
    png.data[i * 4 + 1] = g
    png.data[i * 4 + 2] = b
    png.data[i * 4 + 3] = 255
  }

  return PNG.sync.write(png)
}

const fixturesDir = path.dirname(fileURLToPath(import.meta.url))

fs.mkdirSync(fixturesDir, { recursive: true })
fs.writeFileSync(path.join(fixturesDir, 'img-a.png'), createSolidPNG(10, 10, 255, 0, 0))

const buf = createSolidPNG(10, 10, 255, 0, 0)
const png = PNG.sync.read(buf)
png.data[0] = 0
png.data[2] = 255
fs.writeFileSync(path.join(fixturesDir, 'img-b.png'), PNG.sync.write(png))

fs.writeFileSync(path.join(fixturesDir, 'img-c.png'), createSolidPNG(10, 10, 255, 0, 0))
