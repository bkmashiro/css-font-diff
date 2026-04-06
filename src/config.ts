import fs from 'fs'
import path from 'path'

export interface Config {
  defaultSelector: string
  defaultWidth: number
  defaultThreshold: number
  defaultSelectors: string[]
  snapshotsDir: string
}

const CONFIG_FILE = 'css-font-diff.config.json'

const defaults: Config = {
  defaultSelector: 'body',
  defaultWidth: 1280,
  defaultThreshold: 1.0,
  defaultSelectors: ['h1', 'h2', 'h3', 'p', 'a', 'span'],
  snapshotsDir: 'snapshots',
}

function validateConfig(config: Config): Config {
  if (config.defaultThreshold < 0 || config.defaultThreshold > 100) {
    throw new Error('Config defaultThreshold must be between 0 and 100')
  }

  return config
}

export function loadConfig(configFile = CONFIG_FILE): Config {
  const configPath = path.resolve(configFile)
  if (!fs.existsSync(configPath)) {
    return { ...defaults }
  }

  let raw: string
  let parsed: Partial<Config>
  try {
    raw = fs.readFileSync(configPath, 'utf-8')
    parsed = JSON.parse(raw) as Partial<Config>
  } catch (err) {
    throw new Error(`Failed to parse config file at ${configPath}: ${err instanceof Error ? err.message : err}`)
  }
  return validateConfig({ ...defaults, ...parsed })
}

export function parseWidthOption(value: string | undefined, defaultWidth: number): number {
  return value != null ? parseInt(value, 10) : defaultWidth
}

export function parseThresholdOption(value: string | undefined, defaultThreshold: number): number {
  return value != null ? parseFloat(value) : defaultThreshold
}

export function initConfig(configFile = CONFIG_FILE): void {
  const configPath = path.resolve(configFile)
  if (fs.existsSync(configPath)) {
    console.log(`Config file already exists: ${configFile}`)
    return
  }
  fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8')
  console.log(`Created ${configFile} with defaults.`)
}
