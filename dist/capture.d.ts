export declare function captureSnapshot(url: string, name: string, selector: string, width: number): Promise<string>;
export interface UpdatedBaseline {
    selector: string;
    path: string;
}
export declare function updateBaselineSnapshots(url: string, selectors: string[], width: number, snapshotsDir?: string, baselineName?: string): Promise<UpdatedBaseline[]>;
