import { chromium, firefox, webkit, type BrowserType } from 'playwright'
import fs from 'fs'
import path from 'path'
import { selectorSnapshotPath } from './diff.js'

export type BrowserName = 'chromium' | 'firefox' | 'webkit'
export const ALL_BROWSERS: BrowserName[] = ['chromium', 'firefox', 'webkit']

export type BrowserTypes = Record<BrowserName, Pick<BrowserType, 'launch'>>

const defaultBrowserTypes: BrowserTypes = { chromium, firefox, webkit }

function getBrowserType(name: BrowserName, types: BrowserTypes): Pick<BrowserType, 'launch'> {
  return types[name]
}

export async function captureSnapshot(
  url: string,
  name: string,
  selector: string,
  width: number,
  browserName: BrowserName = 'chromium',
  browserTypes: BrowserTypes = defaultBrowserTypes,
  strictSelectors = false,
  snapshotsDir = 'snapshots'
): Promise<string> {
  const browser = await getBrowserType(browserName, browserTypes).launch()

  try {
    const page = await browser.newPage({ viewport: { width, height: 800 } })
    await page.goto(url, { waitUntil: 'networkidle' })

    if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true })

    const el = await page.$(selector)
    const outPath = path.join(snapshotsDir, `${name}-${browserName}.png`)
    if (el) {
      await el.screenshot({ path: outPath })
    } else {
      if (strictSelectors) {
        throw new Error(`Selector not found: "${selector}"`)
      }
      process.stderr.write(`Warning: selector "${selector}" not found, falling back to full-page screenshot\n`)
      await page.screenshot({ path: outPath })
    }
    return outPath
  } finally {
    await browser.close()
  }
}

export interface UpdatedBaseline {
  selector: string
  path: string
  browser: BrowserName
}

export async function updateBaselineSnapshots(
  url: string,
  selectors: string[],
  width: number,
  snapshotsDir = 'snapshots',
  baselineName = 'baseline',
  browsers: BrowserName[] = ['chromium'],
  browserTypes: BrowserTypes = defaultBrowserTypes
): Promise<UpdatedBaseline[]> {
  const updated: UpdatedBaseline[] = []

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }

  await Promise.all(
    browsers.map(async (browserName) => {
      const browser = await getBrowserType(browserName, browserTypes).launch()
      const page = await browser.newPage({ viewport: { width, height: 800 } })

      try {
        await page.goto(url, { waitUntil: 'networkidle' })

        for (const selector of selectors) {
          const el = await page.$(selector)
          if (!el) {
            throw new Error(`Selector not found while updating baselines: ${selector}`)
          }

          const outPath = selectorSnapshotPath(baselineName, selector, snapshotsDir, browserName)
          await el.screenshot({ path: outPath })
          updated.push({ selector, path: outPath, browser: browserName })
        }
      } finally {
        await browser.close()
      }
    })
  )

  return updated
}
