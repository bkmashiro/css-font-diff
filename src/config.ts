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

  const raw = fs.readFileSync(configPath, 'utf-8')
  const parsed = JSON.parse(raw) as Partial<Config>
  return validateConfig({ ...defaults, ...parsed })
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
