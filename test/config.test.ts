import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { loadConfig } from '../src/config.ts'

function withTempDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-font-diff-config-'))
  fn(dir)
}

test('loadConfig returns defaults when no config file exists', () => {
  withTempDir((dir) => {
    const config = loadConfig(path.join(dir, 'missing.config.json'))

    assert.equal(config.defaultSelector, 'body')
    assert.equal(config.defaultWidth, 1280)
    assert.equal(config.defaultThreshold, 1)
    assert.deepEqual(config.defaultSelectors, ['h1', 'h2', 'h3', 'p', 'a', 'span'])
    assert.equal(config.snapshotsDir, 'snapshots')
  })
})

test('loadConfig loads threshold from config file', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ defaultThreshold: 2.5 }))

    const config = loadConfig(configPath)

    assert.equal(config.defaultThreshold, 2.5)
  })
})

test('loadConfig loads selectors list from config file', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ defaultSelectors: ['.hero', '.body-copy'] }))

    const config = loadConfig(configPath)

    assert.deepEqual(config.defaultSelectors, ['.hero', '.body-copy'])
  })
})

test('loadConfig rejects threshold lower than 0', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ defaultThreshold: -1 }))

    assert.throws(() => loadConfig(configPath), /defaultThreshold must be between 0 and 100/)
  })
})

test('loadConfig rejects threshold higher than 100', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ defaultThreshold: 101 }))

    assert.throws(() => loadConfig(configPath), /defaultThreshold must be between 0 and 100/)
  })
})
