#!/usr/bin/env node

;(async () => {
  await import('./index.js')
})().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
