import chalk from 'chalk'
import type { RegionDiffResult } from './diff.js'

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

export function formatDiffResults(
  results: RegionDiffResult[],
  thresholdPct: number
): { output: string; failCount: number } {
  const lines: string[] = []
  lines.push(chalk.bold('Comparing font regions...'))

  let failCount = 0

  for (const r of results) {
    const label = labelFor(r.selector).padEnd(20)
    if (r.missing) {
      lines.push(`  ${chalk.cyan(label)} ${chalk.yellow('snapshot not found')}  ${chalk.yellow('?')}`)
      continue
    }

    const pctStr = `${r.diffPercent.toFixed(1)}% diff`
    if (r.diffPercent > thresholdPct) {
      failCount++
      lines.push(
        `  ${chalk.cyan(label)} ${chalk.red(pctStr)}  ${chalk.red('exceeds ' + thresholdPct + '% threshold')}`
      )
    } else {
      lines.push(`  ${chalk.cyan(label)} ${chalk.green(pctStr)}  ${chalk.green('ok')}`)
    }
  }

  if (failCount === 0) {
    lines.push('')
    lines.push(chalk.green(`Overall: all regions passed.`))
  } else {
    lines.push('')
    lines.push(chalk.red(`Overall: ${failCount} region(s) failed. Exit code: 1`))
  }

  return { output: lines.join('\n'), failCount }
}

export function formatCaptureDone(outPath: string): string {
  return chalk.green(`Snapshot saved: ${outPath}`)
}
