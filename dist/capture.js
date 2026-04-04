import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { selectorSnapshotPath } from './diff.js';
export async function captureSnapshot(url, name, selector, width) {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    const dir = 'snapshots';
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const el = await page.$(selector);
    const outPath = path.join(dir, `${name}-chromium.png`);
    if (el) {
        await el.screenshot({ path: outPath });
    }
    else {
        await page.screenshot({ path: outPath });
    }
    await browser.close();
    return outPath;
}
export async function updateBaselineSnapshots(url, selectors, width, snapshotsDir = 'snapshots', baselineName = 'baseline') {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    try {
        await page.goto(url, { waitUntil: 'networkidle' });
        if (!fs.existsSync(snapshotsDir)) {
            fs.mkdirSync(snapshotsDir, { recursive: true });
        }
        const updated = [];
        for (const selector of selectors) {
            const el = await page.$(selector);
            if (!el) {
                throw new Error(`Selector not found while updating baselines: ${selector}`);
            }
            const outPath = selectorSnapshotPath(baselineName, selector, snapshotsDir);
            await el.screenshot({ path: outPath });
            updated.push({ selector, path: outPath });
        }
        return updated;
    }
    finally {
        await browser.close();
    }
}
