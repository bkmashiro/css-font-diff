export interface RegionDiffResult {
    selector: string;
    diffPercent: number;
    baseline: string;
    compare: string;
    missing: boolean;
}
export declare function diffImages(img1Path: string, img2Path: string, threshold?: number): number;
export declare function snapshotPath(name: string): string;
export declare function safeSelector(selector: string): string;
export declare function selectorSnapshotPath(snapshotName: string, selector: string, snapshotsDir?: string): string;
export declare function diffSnapshots(baselineName: string, compareName: string, selectors: string[], thresholdPct: number): RegionDiffResult[];
