import chalk from 'chalk'
import type { RegionDiffResult, MultiBrowserDiffResult } from './diff.js'
import type { UpdatedBaseline, BrowserName } from './capture.js'

const SELECTOR_LABELS: Record<string, string> = {
  h1: 'Title (h1)',
  h2: 'Heading 2 (h2)',
  h3: 'Heading 3 (h3)',
  p: 'Body text (p)',
  a: 'Link (a)',
  span: 'Inline (span)',
}

function labelFor(selector: string): string {
  return SELECTOR_LABELS[selector] ?? selector
}

/**
 * Returns a human-readable pass/fail status string for a single region diff.
 *
 * @param diff - The measured pixel-difference percentage for a region.
 * @param thresholdPct - The maximum allowed difference percentage before a region is
 *   considered failed.
 * @returns `"✓ passed"` when `diff <= thresholdPct`, otherwise a string of the form
 *   `"✗ failed (X.X% > Y.Y%)"`.
 */
export function formatDiffStatus(diff: number, thresholdPct: number): string {
  if (diff > thresholdPct) {
    return `✗ failed (${diff.toFixed(1)}% > ${thresholdPct.toFixed(1)}%)`
  }

  return '✓ passed'
}

export function formatSummary(passCount: number, failCount: number): string {
  return `Summary: ${passCount} passed, ${failCount} failed`
}

/**
 * Formats a complete per-region diff report as a coloured terminal string.
 *
 * Each result line shows the region label and its pass/fail status. Missing snapshots
 * are shown separately. A summary line is appended at the end.
 *
 * @param results - Array of {@link RegionDiffResult} objects returned by `diffSnapshots`.
 * @param thresholdPct - The maximum allowed pixel-difference percentage. Results above
 *   this value are rendered as failures.
 * @returns An object with:
 *   - `output` — the full formatted report ready to print to stdout.
 *   - `failCount` — the number of regions that exceeded `thresholdPct` (excludes missing).
 */
export function formatDiffResults(
  results: RegionDiffResult[],
  thresholdPct: number
): { output: string; failCount: number } {
  const lines: string[] = []
  lines.push(chalk.bold('Comparing font regions...'))

  let failCount = 0
  let passCount = 0

  for (const r of results) {
    const label = labelFor(r.selector).padEnd(20)
    if (r.missing) {
      lines.push(`  ${chalk.cyan(label)} ${chalk.yellow('snapshot not found')}  ${chalk.yellow('?')}`)
      continue
    }

    if (r.diffPercent > thresholdPct) {
      failCount++
      lines.push(`  ${chalk.cyan(label)} ${chalk.red(formatDiffStatus(r.diffPercent, thresholdPct))}`)
    } else {
      passCount++
      lines.push(`  ${chalk.cyan(label)} ${chalk.green(formatDiffStatus(r.diffPercent, thresholdPct))}`)
    }
  }

  if (failCount === 0) {
    lines.push('')
    lines.push(chalk.green(formatSummary(passCount, failCount)))
  } else {
    lines.push('')
    lines.push(chalk.red(formatSummary(passCount, failCount)))
  }

  return { output: lines.join('\n'), failCount }
}

export function formatCaptureDone(outPath: string): string {
  return chalk.green(`Snapshot saved: ${outPath}`)
}

const BROWSER_LABELS: Record<BrowserName, string> = {
  chromium: 'Chromium',
  firefox: 'Firefox',
  webkit: 'WebKit',
}

/**
 * Formats a multi-browser diff report as a coloured terminal table.
 *
 * Renders one row per selector with a column for each browser. Each cell shows the
 * diff percentage (green = passed, red = failed, yellow = snapshot missing). A summary
 * line with total pass/fail counts across all browsers is appended.
 *
 * @param results - Array of {@link MultiBrowserDiffResult} objects, one per selector.
 * @param thresholdPct - The maximum allowed pixel-difference percentage per cell.
 * @param browsers - Ordered list of browsers to display as columns.
 * @returns The formatted report as a single string ready to print to stdout.
 */
export function formatMultiBrowserReport(
  results: MultiBrowserDiffResult[],
  thresholdPct: number,
  browsers: BrowserName[]
): string {
  const lines: string[] = []
  lines.push(chalk.bold('Multi-browser font diff report'))
  lines.push('')

  // Header row
  const selectorCol = 'Selector'.padEnd(20)
  const browserCols = browsers.map((b) => BROWSER_LABELS[b].padEnd(18)).join('')
  lines.push(`  ${chalk.bold(selectorCol)}${browserCols}`)
  lines.push('  ' + '-'.repeat(20 + browsers.length * 18))

  let totalFail = 0
  let totalPass = 0

  for (const r of results) {
    const label = labelFor(r.selector).padEnd(20)
    const cols = browsers.map((b) => {
      const data = r.browsers[b]
      if (!data || data.missing) return chalk.yellow('? missing'.padEnd(18))
      if (data.diffPercent > thresholdPct) {
        totalFail++
        return chalk.red(`✗ ${data.diffPercent.toFixed(1)}%`.padEnd(18))
      }
      totalPass++
      return chalk.green(`✓ ${data.diffPercent.toFixed(1)}%`.padEnd(18))
    }).join('')
    lines.push(`  ${chalk.cyan(label)}${cols}`)
  }

  lines.push('')
  const summary = `Summary: ${totalPass} passed, ${totalFail} failed (across ${browsers.length} browsers)`
  lines.push(totalFail === 0 ? chalk.green(summary) : chalk.red(summary))

  return lines.join('\n')
}

export function formatBaselineUpdateDone(updated: UpdatedBaseline[]): string {
  const lines = ['Updating baselines...']

  for (const entry of updated) {
    lines.push(`  ${chalk.green('✓')} ${chalk.cyan(entry.selector)} -> ${entry.path} updated`)
  }

  lines.push(`${updated.length} baselines updated.`)
  return lines.join('\n')
}
