import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { execSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

test('CLI --version reports the version from package.json', () => {
  const output = execSync('node --import tsx/esm src/index.ts --version', {
    cwd: new URL('..', import.meta.url).pathname,
    encoding: 'utf8',
  }).trim()
  assert.equal(output, pkg.version)
})

test('package.json version is a valid semver string', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+/)
})
