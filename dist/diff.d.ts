import type { BrowserName } from './capture.js';
export interface RegionDiffResult {
    selector: string;
    diffPercent: number;
    baseline: string;
    compare: string;
    missing: boolean;
    browser?: BrowserName;
}
export interface MultiBrowserDiffResult {
    selector: string;
    browsers: Record<BrowserName, {
        diffPercent: number;
        missing: boolean;
    }>;
}
export declare function diffImages(img1Path: string, img2Path: string, threshold?: number): number;
export declare function snapshotPath(name: string, browserName?: BrowserName): string;
export declare function safeSelector(selector: string): string;
export declare function selectorSnapshotPath(snapshotName: string, selector: string, snapshotsDir?: string, browserName?: BrowserName): string;
export declare function diffSnapshots(baselineName: string, compareName: string, selectors: string[], thresholdPct: number, browserName?: BrowserName): RegionDiffResult[];
export declare function diffSnapshotsAllBrowsers(baselineName: string, compareName: string, selectors: string[], thresholdPct: number, browsers: BrowserName[]): MultiBrowserDiffResult[];
