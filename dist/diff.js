import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';
import path from 'path';
export function diffImages(img1Path, img2Path, threshold = 0.1) {
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));
    if (img1.width !== img2.width || img1.height !== img2.height) {
        throw new Error(`Image dimensions do not match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
    }
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    const numDiff = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold });
    return (numDiff / (width * height)) * 100;
}
export function snapshotPath(name, browserName = 'chromium') {
    return path.join('snapshots', `${name}-${browserName}.png`);
}
export function safeSelector(selector) {
    return selector.replace(/[^a-zA-Z0-9_-]/g, '_');
}
export function selectorSnapshotPath(snapshotName, selector, snapshotsDir = 'snapshots', browserName = 'chromium') {
    return path.join(snapshotsDir, `${snapshotName}-${safeSelector(selector)}-${browserName}.png`);
}
export function diffSnapshots(baselineName, compareName, selectors, thresholdPct, browserName = 'chromium') {
    const results = [];
    for (const selector of selectors) {
        const baselinePath = selectorSnapshotPath(baselineName, selector, 'snapshots', browserName);
        const comparePath = selectorSnapshotPath(compareName, selector, 'snapshots', browserName);
        if (!fs.existsSync(baselinePath) || !fs.existsSync(comparePath)) {
            results.push({
                selector,
                diffPercent: 0,
                baseline: baselinePath,
                compare: comparePath,
                missing: true,
                browser: browserName,
            });
            continue;
        }
        try {
            const diffPercent = diffImages(baselinePath, comparePath, thresholdPct / 100);
            results.push({
                selector,
                diffPercent,
                baseline: baselinePath,
                compare: comparePath,
                missing: false,
                browser: browserName,
            });
        }
        catch (err) {
            results.push({
                selector,
                diffPercent: 0,
                baseline: baselinePath,
                compare: comparePath,
                missing: true,
                browser: browserName,
            });
        }
    }
    return results;
}
export function diffSnapshotsAllBrowsers(baselineName, compareName, selectors, thresholdPct, browsers) {
    return selectors.map((selector) => {
        const browserResults = {};
        for (const browserName of browsers) {
            const baselinePath = selectorSnapshotPath(baselineName, selector, 'snapshots', browserName);
            const comparePath = selectorSnapshotPath(compareName, selector, 'snapshots', browserName);
            if (!fs.existsSync(baselinePath) || !fs.existsSync(comparePath)) {
                browserResults[browserName] = { diffPercent: 0, missing: true };
                continue;
            }
            try {
                const diffPercent = diffImages(baselinePath, comparePath, thresholdPct / 100);
                browserResults[browserName] = { diffPercent, missing: false };
            }
            catch {
                browserResults[browserName] = { diffPercent: 0, missing: true };
            }
        }
        return { selector, browsers: browserResults };
    });
}
