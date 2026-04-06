import { chromium, firefox, webkit, type BrowserType } from 'playwright'
import fs from 'fs'
import path from 'path'
import { selectorSnapshotPath } from './diff.js'

export type BrowserName = 'chromium' | 'firefox' | 'webkit'
export const ALL_BROWSERS: BrowserName[] = ['chromium', 'firefox', 'webkit']

function getBrowserType(name: BrowserName): BrowserType {
  switch (name) {
    case 'chromium': return chromium
    case 'firefox': return firefox
    case 'webkit': return webkit
  }
}

export async function captureSnapshot(
  url: string,
  name: string,
  selector: string,
  width: number,
  browserName: BrowserName = 'chromium',
  snapshotsDir = 'snapshots'
): Promise<string> {
  const browser = await getBrowserType(browserName).launch()
  const page = await browser.newPage({ viewport: { width, height: 800 } })
  await page.goto(url, { waitUntil: 'networkidle' })

  if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir, { recursive: true })

  const el = await page.$(selector)
  const outPath = path.join(snapshotsDir, `${name}-${browserName}.png`)
  if (el) {
    await el.screenshot({ path: outPath })
  } else {
    await page.screenshot({ path: outPath })
  }
  await browser.close()
  return outPath
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
  browsers: BrowserName[] = ['chromium']
): Promise<UpdatedBaseline[]> {
  const updated: UpdatedBaseline[] = []

  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true })
  }

  await Promise.all(
    browsers.map(async (browserName) => {
      const browser = await getBrowserType(browserName).launch()
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
