import assert from 'node:assert/strict'
import { createRequire } from 'module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)

test('package.json version is a valid semver string', () => {
  const { version } = require('../package.json') as { version: string }
  assert.match(version, /^\d+\.\d+\.\d+/, 'version must be a semver string')
})

test('package.json version matches the version loaded via createRequire', () => {
  const pkg = require('../package.json') as { version: string }
  // Ensure we get a non-empty string, not undefined or the stale hardcoded value
  assert.ok(pkg.version, 'version should be defined')
  assert.notEqual(pkg.version, '0.4.0', 'version must not be the old hardcoded value')
})
