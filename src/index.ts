#!/usr/bin/env node
import { createRequire } from 'module'
import { Command } from 'commander'
import { captureSnapshot, updateBaselineSnapshots, ALL_BROWSERS, type BrowserName } from './capture.js'
import { diffSnapshots, diffSnapshotsAllBrowsers } from './diff.js'
import {
  formatBaselineUpdateDone,
  formatDiffResults,
  formatCaptureDone,
  formatMultiBrowserReport,
} from './formatter.js'
import { upsertDiffComment } from './github-comment.js'
import { loadConfig, initConfig } from './config.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { version } = require('../package.json')

const require = createRequire(import.meta.url)
const { version } = require('../package.json') as { version: string }

const program = new Command()

program
  .name('css-font-diff')
  .description('Detect cross-browser font rendering differences with pixel-level precision')
  .version(version)

function parseBrowserOption(value: string): BrowserName[] {
  if (value === 'all') return ALL_BROWSERS
  const names = value.split(',').map((s) => s.trim()) as BrowserName[]
  for (const name of names) {
    if (!ALL_BROWSERS.includes(name)) {
      throw new Error(`Unknown browser: "${name}". Valid values: chromium, firefox, webkit, all`)
    }
  }
  return names
}

// ── capture ────────────────────────────────────────────────────────────────
program
  .command('capture')
  .description('Capture a page snapshot using Playwright')
  .requiredOption('--url <url>', 'Page URL to capture')
  .option('--name <name>', 'Snapshot name', 'snapshot')
  .option('--selector <sel>', 'CSS selector to screenshot', 'body')
  .option('--width <px>', 'Viewport width in pixels', '1280')
  .option('--browser <browser>', 'Browser(s) to use: chromium|firefox|webkit|all (comma-separated)', 'chromium')
  .option('--baseline-update', 'Update baseline screenshots for configured selectors')
  .option('--update-baselines', 'Alias for --baseline-update')
  .action(
    async (opts: {
      url: string
      name: string
      selector: string
      width: string
      browser: string
      baselineUpdate?: boolean
      updateBaselines?: boolean
    }) => {
      const config = loadConfig()
      const width = parseInt(opts.width, 10) || config.defaultWidth
      let browsers: BrowserName[]
      try {
        browsers = parseBrowserOption(opts.browser)
      } catch (err) {
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
      }

      try {
        if (opts.baselineUpdate || opts.updateBaselines) {
          const updated = await updateBaselineSnapshots(
            opts.url,
            config.defaultSelectors,
            width,
            config.snapshotsDir,
            'baseline',
            browsers
          )
          console.log(formatBaselineUpdateDone(updated))
          return
        }

        const outPaths: string[] = await Promise.all(
          browsers.map((b) => captureSnapshot(opts.url, opts.name, opts.selector, width, b))
        )
        for (const outPath of outPaths) {
          console.log(formatCaptureDone(outPath))
        }
      } catch (err) {
        console.error('Capture failed:', err instanceof Error ? err.message : err)
        process.exit(1)
      }
    }
  )

// ── diff ───────────────────────────────────────────────────────────────────
program
  .command('diff')
  .description('Diff two snapshots across CSS selectors')
  .requiredOption('--baseline <name>', 'Baseline snapshot name')
  .requiredOption('--compare <name>', 'Comparison snapshot name')
  .option('--threshold <pct>', 'Pixel diff threshold % (default: 1.0)', '1.0')
  .option('--selector <sel>', 'Single CSS selector to compare')
  .option(
    '--selectors <list>',
    'Comma-separated CSS selectors to compare',
    'h1,h2,h3,p,a,span'
  )
  .option('--browser <browser>', 'Browser(s) to use: chromium|firefox|webkit|all (comma-separated)', 'chromium')
  .option('--json', 'Output results as JSON')
  .option('--ci-comment', 'Create or update a GitHub PR comment with the diff results')
  .action(
    async (opts: {
      baseline: string
      compare: string
      threshold: string
      selector?: string
      selectors: string
      browser: string
      json: boolean
      ciComment?: boolean
    }) => {
      const config = loadConfig()
      const thresholdPct = parseFloat(opts.threshold) || config.defaultThreshold
      const selectors = opts.selector
        ? [opts.selector]
        : opts.selectors
        ? opts.selectors.split(',').map((s) => s.trim())
        : config.defaultSelectors

      let browsers: BrowserName[]
      try {
        browsers = parseBrowserOption(opts.browser)
      } catch (err) {
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
      }

      const isMultiBrowser = browsers.length > 1

      if (isMultiBrowser) {
        const multiResults = diffSnapshotsAllBrowsers(
          opts.baseline,
          opts.compare,
          selectors,
          thresholdPct,
          browsers,
          config.snapshotsDir
        )

        if (opts.json) {
          console.log(JSON.stringify(multiResults, null, 2))
        } else {
          console.log(formatMultiBrowserReport(multiResults, thresholdPct, browsers))
        }

        const failed = multiResults.some((r) =>
          browsers.some(
            (b) => !r.browsers[b]?.missing && (r.browsers[b]?.diffPercent ?? 0) > thresholdPct
          )
        )
        process.exit(failed ? 1 : 0)
      } else {
        const browserName = browsers[0]
        const results = diffSnapshots(opts.baseline, opts.compare, selectors, thresholdPct, browserName, config.snapshotsDir)

        if (opts.json) {
          console.log(JSON.stringify(results, null, 2))
        } else {
          const { output } = formatDiffResults(results, thresholdPct)
          console.log(output)
        }

        if (opts.ciComment) {
          try {
            const comment = await upsertDiffComment(results, thresholdPct)
            console.log(`Posting diff results to PR #${comment.prNumber}...`)
            console.log('')
            console.log(`${comment.updated ? 'Updated' : 'Posted'} comment:`)
            console.log(comment.body.replace('<!-- css-font-diff-report -->\n', ''))
          } catch (err) {
            console.error('Failed to post PR comment:', err instanceof Error ? err.message : err)
            process.exit(1)
          }
        }

        const failed = results.filter((r) => !r.missing && r.diffPercent > thresholdPct)
        process.exit(failed.length > 0 ? 1 : 0)
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
