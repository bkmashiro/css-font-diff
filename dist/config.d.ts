export interface Config {
    defaultSelector: string;
    defaultWidth: number;
    defaultThreshold: number;
    defaultSelectors: string[];
    snapshotsDir: string;
}
export declare function loadConfig(configFile?: string): Config;
export declare function initConfig(configFile?: string): void;
