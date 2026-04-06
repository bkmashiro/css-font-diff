import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { initConfig, loadConfig } from '../src/config.ts'

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

test('loadConfig throws descriptive error for malformed JSON', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, '{ "defaultThreshold": }')

    assert.throws(
      () => loadConfig(configPath),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.ok(err.message.includes(configPath), `Expected path in error: ${err.message}`)
        assert.ok(err.message.startsWith('Failed to parse config file at '), `Unexpected message: ${err.message}`)
        return true
      },
    )
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

test('initConfig creates a config file with defaults', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    const output: string[] = []
    const originalLog = console.log
    console.log = (message?: unknown) => {
      output.push(String(message))
    }

    try {
      initConfig(configPath)
    } finally {
      console.log = originalLog
    }

    assert.equal(fs.existsSync(configPath), true)
    assert.match(output[0] ?? '', /Created .*css-font-diff\.config\.json with defaults\./)

    const config = loadConfig(configPath)
    assert.equal(config.defaultSelector, 'body')
    assert.equal(config.defaultWidth, 1280)
    assert.equal(config.defaultThreshold, 1)
    assert.deepEqual(config.defaultSelectors, ['h1', 'h2', 'h3', 'p', 'a', 'span'])
    assert.equal(config.snapshotsDir, 'snapshots')
  })
})

test('initConfig does not overwrite an existing config file', () => {
  withTempDir((dir) => {
    const configPath = path.join(dir, 'css-font-diff.config.json')
    fs.writeFileSync(configPath, JSON.stringify({ defaultThreshold: 2.5 }) + '\n')
    const originalContents = fs.readFileSync(configPath, 'utf-8')
    const output: string[] = []
    const originalLog = console.log
    console.log = (message?: unknown) => {
      output.push(String(message))
    }

    try {
      initConfig(configPath)
    } finally {
      console.log = originalLog
    }

    assert.equal(fs.readFileSync(configPath, 'utf-8'), originalContents)
    assert.match(output[0] ?? '', /Config file already exists: .*css-font-diff\.config\.json/)
  })
})
