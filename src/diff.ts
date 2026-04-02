import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import fs from 'fs'
import path from 'path'

export interface RegionDiffResult {
  selector: string
  diffPercent: number
  baseline: string
  compare: string
  missing: boolean
}

export function diffImages(img1Path: string, img2Path: string, threshold = 0.1): number {
  const img1 = PNG.sync.read(fs.readFileSync(img1Path))
  const img2 = PNG.sync.read(fs.readFileSync(img2Path))
  if (img1.width !== img2.width || img1.height !== img2.height) {
    throw new Error(
      `Image dimensions do not match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`
    )
  }
  const { width, height } = img1
  const diff = new PNG({ width, height })
  const numDiff = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold })
  return (numDiff / (width * height)) * 100
}

export function snapshotPath(name: string): string {
  return path.join('snapshots', `${name}-chromium.png`)
}

export function diffSnapshots(
  baselineName: string,
  compareName: string,
  selectors: string[],
  thresholdPct: number
): RegionDiffResult[] {
  const results: RegionDiffResult[] = []

  for (const selector of selectors) {
    // Encode selector to a safe filename segment
    const safeSelector = selector.replace(/[^a-zA-Z0-9_-]/g, '_')
    const baselinePath = path.join('snapshots', `${baselineName}-${safeSelector}-chromium.png`)
    const comparePath = path.join('snapshots', `${compareName}-${safeSelector}-chromium.png`)

    if (!fs.existsSync(baselinePath) || !fs.existsSync(comparePath)) {
      results.push({
        selector,
        diffPercent: 0,
        baseline: baselinePath,
        compare: comparePath,
        missing: true,
      })
      continue
    }

    try {
      const diffPercent = diffImages(baselinePath, comparePath, thresholdPct / 100)
      results.push({
        selector,
        diffPercent,
        baseline: baselinePath,
        compare: comparePath,
        missing: false,
      })
    } catch (err) {
      results.push({
        selector,
        diffPercent: 0,
        baseline: baselinePath,
        compare: comparePath,
        missing: true,
      })
    }
  }

  return results
}
