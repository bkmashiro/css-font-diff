import type { RegionDiffResult } from './diff.js';
import type { UpdatedBaseline } from './capture.js';
export interface JsonDiffResult {
    selector: string;
    diff: number;
    threshold: number;
    passed: boolean;
}
export declare function formatDiffStatus(diff: number, thresholdPct: number): string;
export declare function toJsonDiffResult(selector: string, diff: number, thresholdPct: number): JsonDiffResult;
export declare function formatSummary(passCount: number, failCount: number): string;
export declare function formatDiffResults(results: RegionDiffResult[], thresholdPct: number): {
    output: string;
    failCount: number;
};
export declare function formatCaptureDone(outPath: string): string;
export declare function formatBaselineUpdateDone(updated: UpdatedBaseline[]): string;
