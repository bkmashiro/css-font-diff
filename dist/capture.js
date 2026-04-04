import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import { selectorSnapshotPath } from './diff.js';
export const ALL_BROWSERS = ['chromium', 'firefox', 'webkit'];
function getBrowserType(name) {
    switch (name) {
        case 'chromium': return chromium;
        case 'firefox': return firefox;
        case 'webkit': return webkit;
    }
}
export async function captureSnapshot(url, name, selector, width, browserName = 'chromium') {
    const browser = await getBrowserType(browserName).launch();
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(url, { waitUntil: 'networkidle' });
    const dir = 'snapshots';
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    const el = await page.$(selector);
    const outPath = path.join(dir, `${name}-${browserName}.png`);
    if (el) {
        await el.screenshot({ path: outPath });
    }
    else {
        await page.screenshot({ path: outPath });
    }
    await browser.close();
    return outPath;
}
export async function updateBaselineSnapshots(url, selectors, width, snapshotsDir = 'snapshots', baselineName = 'baseline', browsers = ['chromium']) {
    const updated = [];
    if (!fs.existsSync(snapshotsDir)) {
        fs.mkdirSync(snapshotsDir, { recursive: true });
    }
    await Promise.all(browsers.map(async (browserName) => {
        const browser = await getBrowserType(browserName).launch();
        const page = await browser.newPage({ viewport: { width, height: 800 } });
        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            for (const selector of selectors) {
                const el = await page.$(selector);
                if (!el) {
                    throw new Error(`Selector not found while updating baselines: ${selector}`);
                }
                const outPath = selectorSnapshotPath(baselineName, selector, snapshotsDir, browserName);
                await el.screenshot({ path: outPath });
                updated.push({ selector, path: outPath, browser: browserName });
            }
        }
        finally {
            await browser.close();
        }
    }));
    return updated;
}
