import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import fs from 'fs'
import path from 'path'
import type { BrowserName } from './capture.js'

export interface RegionDiffResult {
  selector: string
  diffPercent: number
  baseline: string
  compare: string
  missing: boolean
  browser?: BrowserName
}

export interface MultiBrowserDiffResult {
  selector: string
  browsers: Record<BrowserName, { diffPercent: number; missing: boolean }>
}

/**
 * Compares two PNG images pixel-by-pixel and returns the percentage of differing pixels.
 *
 * @param img1Path - Absolute or relative path to the first (baseline) PNG image.
 * @param img2Path - Absolute or relative path to the second (compare) PNG image.
 * @param threshold - Per-pixel color distance tolerance in the range [0, 1]. Lower values
 *   are stricter (0 = exact match required, 1 = any color is considered equal). Defaults to 0.1.
 * @returns The percentage of pixels that differ, in the range [0, 100].
 * @throws {Error} If either file cannot be read or is not a valid PNG.
 * @throws {Error} If the two images have different dimensions.
 */
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

export function snapshotPath(name: string, browserName: BrowserName = 'chromium'): string {
  return path.join('snapshots', `${name}-${browserName}.png`)
}

/**
 * Converts a CSS selector string into a safe filename-friendly token by replacing any
 * character that is not alphanumeric, underscore, or hyphen with an underscore.
 *
 * @example
 * safeSelector('#hero')   // → '_hero'
 * safeSelector('.nav > a') // → '_nav___a'
 *
 * @param selector - A CSS selector string (e.g. `#hero`, `.card`, `h1`).
 * @returns The sanitized string, safe for use in file and directory names.
 */
export function safeSelector(selector: string): string {
  return selector.replace(/[^a-zA-Z0-9_-]/g, '_')
}

export function selectorSnapshotPath(
  snapshotName: string,
  selector: string,
  snapshotsDir = 'snapshots',
  browserName: BrowserName = 'chromium'
): string {
  return path.join(snapshotsDir, `${snapshotName}-${safeSelector(selector)}-${browserName}.png`)
}

/**
 * Diffs baseline and compare snapshots for each CSS selector in a single browser.
 *
 * For each selector, the function looks up the corresponding PNG files under the
 * `snapshots/` directory. If either file is missing, or if the images have mismatched
 * dimensions, the result is marked as `missing: true` with `diffPercent: 0`.
 *
 * @param baselineName - Snapshot set name used as the baseline (e.g. `"before"`).
 * @param compareName - Snapshot set name to compare against the baseline (e.g. `"after"`).
 * @param selectors - Array of CSS selectors to compare (e.g. `["h1", "#hero"]`).
 * @param thresholdPct - Pixel-difference threshold expressed as a percentage [0, 100].
 *   Internally converted to the [0, 1] range expected by {@link diffImages}.
 * @param browserName - Browser whose snapshots should be compared. Defaults to `"chromium"`.
 * @returns An array of {@link RegionDiffResult} objects, one per selector, ordered to match
 *   the input `selectors` array.
 */
export function diffSnapshots(
  baselineName: string,
  compareName: string,
  selectors: string[],
  thresholdPct: number,
  browserName: BrowserName = 'chromium'
): RegionDiffResult[] {
  const results: RegionDiffResult[] = []

  for (const selector of selectors) {
    const baselinePath = selectorSnapshotPath(baselineName, selector, 'snapshots', browserName)
    const comparePath = selectorSnapshotPath(compareName, selector, 'snapshots', browserName)

    if (!fs.existsSync(baselinePath) || !fs.existsSync(comparePath)) {
      results.push({
        selector,
        diffPercent: 0,
        baseline: baselinePath,
        compare: comparePath,
        missing: true,
        browser: browserName,
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
        browser: browserName,
      })
    } catch (err) {
      results.push({
        selector,
        diffPercent: 0,
        baseline: baselinePath,
        compare: comparePath,
        missing: true,
        browser: browserName,
      })
    }
  }

  return results
}

/**
 * Diffs baseline and compare snapshots for each CSS selector across multiple browsers.
 *
 * For every (selector, browser) pair the function looks up the corresponding PNG files.
 * Missing files or dimension mismatches are recorded as `{ diffPercent: 0, missing: true }`.
 *
 * @param baselineName - Snapshot set name used as the baseline (e.g. `"before"`).
 * @param compareName - Snapshot set name to compare against the baseline (e.g. `"after"`).
 * @param selectors - Array of CSS selectors to compare (e.g. `["h1", "#hero"]`).
 * @param thresholdPct - Pixel-difference threshold expressed as a percentage [0, 100].
 *   Internally converted to the [0, 1] range expected by {@link diffImages}.
 * @param browsers - List of browsers to include in the comparison.
 * @returns An array of {@link MultiBrowserDiffResult} objects, one per selector, each
 *   containing per-browser diff data keyed by browser name.
 */
export function diffSnapshotsAllBrowsers(
  baselineName: string,
  compareName: string,
  selectors: string[],
  thresholdPct: number,
  browsers: BrowserName[]
): MultiBrowserDiffResult[] {
  return selectors.map((selector) => {
    const browserResults = {} as Record<BrowserName, { diffPercent: number; missing: boolean }>

    for (const browserName of browsers) {
      const baselinePath = selectorSnapshotPath(baselineName, selector, 'snapshots', browserName)
      const comparePath = selectorSnapshotPath(compareName, selector, 'snapshots', browserName)

      if (!fs.existsSync(baselinePath) || !fs.existsSync(comparePath)) {
        browserResults[browserName] = { diffPercent: 0, missing: true }
        continue
      }

      try {
        const diffPercent = diffImages(baselinePath, comparePath, thresholdPct / 100)
        browserResults[browserName] = { diffPercent, missing: false }
      } catch {
        browserResults[browserName] = { diffPercent: 0, missing: true }
      }
    }

    return { selector, browsers: browserResults }
  })
}
