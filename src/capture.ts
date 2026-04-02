import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

export async function captureSnapshot(
  url: string,
  name: string,
  selector: string,
  width: number
): Promise<string> {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width, height: 800 } })
  await page.goto(url, { waitUntil: 'networkidle' })

  const dir = 'snapshots'
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  const el = await page.$(selector)
  const outPath = path.join(dir, `${name}-chromium.png`)
  if (el) {
    await el.screenshot({ path: outPath })
  } else {
    await page.screenshot({ path: outPath })
  }
  await browser.close()
  return outPath
}
