import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

test('--version reports the version from package.json', () => {
  const output = execSync('node --import tsx/esm src/index.ts --version', {
    encoding: 'utf8',
  }).trim()
  assert.equal(output, version)
})

test('package.json version is a valid semver string', () => {
  assert.match(version, /^\d+\.\d+\.\d+/)
})
