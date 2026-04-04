import type { RegionDiffResult } from './diff.js';
export interface GitHubContext {
    token: string;
    repository: string;
    prNumber: number;
}
export interface UpsertCommentResult {
    body: string;
    prNumber: number;
    updated: boolean;
}
type FetchLike = typeof fetch;
export declare function buildDiffMarkdownTable(results: RegionDiffResult[], thresholdPct: number): string;
export declare function readGitHubContext(env?: NodeJS.ProcessEnv): GitHubContext;
export declare function upsertDiffComment(results: RegionDiffResult[], thresholdPct: number, env?: NodeJS.ProcessEnv, fetchImpl?: FetchLike): Promise<UpsertCommentResult>;
export {};
