import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseWidthOption, parseThresholdOption } from '../src/config.ts'

test('parseWidthOption returns parsed value for normal input', () => {
  assert.equal(parseWidthOption('1280', 800), 1280)
})

test('parseWidthOption returns 0 when user passes --width 0', () => {
  assert.equal(parseWidthOption('0', 1280), 0)
})

test('parseWidthOption returns default when option is undefined', () => {
  assert.equal(parseWidthOption(undefined, 1280), 1280)
})

test('parseThresholdOption returns parsed value for normal input', () => {
  assert.equal(parseThresholdOption('2.5', 1), 2.5)
})

test('parseThresholdOption returns 0 when user passes --threshold 0', () => {
  assert.equal(parseThresholdOption('0', 1), 0)
})

test('parseThresholdOption returns default when option is undefined', () => {
  assert.equal(parseThresholdOption(undefined, 1), 1)
})
