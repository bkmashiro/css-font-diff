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

export function loadConfig(): Config {
  try {
    const configPath = path.resolve(CONFIG_FILE)
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Config>
      return { ...defaults, ...parsed }
    }
  } catch {
    // ignore parse errors, use defaults
  }
  return { ...defaults }
}

export function initConfig(): void {
  const configPath = path.resolve(CONFIG_FILE)
  if (fs.existsSync(configPath)) {
    console.log(`Config file already exists: ${CONFIG_FILE}`)
    return
  }
  fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8')
  console.log(`Created ${CONFIG_FILE} with defaults.`)
}
