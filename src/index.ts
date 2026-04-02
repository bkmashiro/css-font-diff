#!/usr/bin/env node
import { Command } from 'commander'
import { captureSnapshot } from './capture.js'
import { diffSnapshots } from './diff.js'
import { formatDiffResults, formatCaptureDone } from './formatter.js'
import { loadConfig, initConfig } from './config.js'

const program = new Command()

program
  .name('css-font-diff')
  .description('Detect cross-browser font rendering differences with pixel-level precision')
  .version('0.1.0')

// ── capture ────────────────────────────────────────────────────────────────
program
  .command('capture')
  .description('Capture a page snapshot using Playwright (chromium)')
  .requiredOption('--url <url>', 'Page URL to capture')
  .option('--name <name>', 'Snapshot name', 'snapshot')
  .option('--selector <sel>', 'CSS selector to screenshot', 'body')
  .option('--width <px>', 'Viewport width in pixels', '1280')
  .action(async (opts: { url: string; name: string; selector: string; width: string }) => {
    const config = loadConfig()
    const width = parseInt(opts.width, 10) || config.defaultWidth
    try {
      const outPath = await captureSnapshot(opts.url, opts.name, opts.selector, width)
      console.log(formatCaptureDone(outPath))
    } catch (err) {
      console.error('Capture failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    }
  })

// ── diff ───────────────────────────────────────────────────────────────────
program
  .command('diff')
  .description('Diff two snapshots across CSS selectors')
  .requiredOption('--baseline <name>', 'Baseline snapshot name')
  .requiredOption('--compare <name>', 'Comparison snapshot name')
  .option('--threshold <pct>', 'Pixel diff threshold % (default: 1.0)', '1.0')
  .option(
    '--selectors <list>',
    'Comma-separated CSS selectors to compare',
    'h1,h2,h3,p,a,span'
  )
  .option('--json', 'Output results as JSON')
  .action(
    async (opts: {
      baseline: string
      compare: string
      threshold: string
      selectors: string
      json: boolean
    }) => {
      const config = loadConfig()
      const thresholdPct = parseFloat(opts.threshold) || config.defaultThreshold
      const selectors = opts.selectors
        ? opts.selectors.split(',').map((s) => s.trim())
        : config.defaultSelectors

      const results = diffSnapshots(opts.baseline, opts.compare, selectors, thresholdPct)

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2))
        const failed = results.filter((r) => !r.missing && r.diffPercent > thresholdPct)
        process.exit(failed.length > 0 ? 1 : 0)
      } else {
        const { output, failCount } = formatDiffResults(results, thresholdPct)
        console.log(output)
        process.exit(failCount > 0 ? 1 : 0)
      }
    }
  )

// ── init ───────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Create css-font-diff.config.json with defaults')
  .action(() => {
    initConfig()
  })

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
