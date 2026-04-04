import chalk from 'chalk';
const SELECTOR_LABELS = {
    h1: 'Title (h1)',
    h2: 'Heading 2 (h2)',
    h3: 'Heading 3 (h3)',
    p: 'Body text (p)',
    a: 'Link (a)',
    span: 'Inline (span)',
};
function labelFor(selector) {
    return SELECTOR_LABELS[selector] ?? selector;
}
export function formatDiffStatus(diff, thresholdPct) {
    if (diff > thresholdPct) {
        return `✗ failed (${diff.toFixed(1)}% > ${thresholdPct.toFixed(1)}%)`;
    }
    return '✓ passed';
}
export function toJsonDiffResult(selector, diff, thresholdPct) {
    return {
        selector,
        diff,
        threshold: thresholdPct,
        passed: diff <= thresholdPct,
    };
}
export function formatSummary(passCount, failCount) {
    return `Summary: ${passCount} passed, ${failCount} failed`;
}
export function formatDiffResults(results, thresholdPct) {
    const lines = [];
    lines.push(chalk.bold('Comparing font regions...'));
    let failCount = 0;
    let passCount = 0;
    for (const r of results) {
        const label = labelFor(r.selector).padEnd(20);
        if (r.missing) {
            lines.push(`  ${chalk.cyan(label)} ${chalk.yellow('snapshot not found')}  ${chalk.yellow('?')}`);
            continue;
        }
        if (r.diffPercent > thresholdPct) {
            failCount++;
            lines.push(`  ${chalk.cyan(label)} ${chalk.red(formatDiffStatus(r.diffPercent, thresholdPct))}`);
        }
        else {
            passCount++;
            lines.push(`  ${chalk.cyan(label)} ${chalk.green(formatDiffStatus(r.diffPercent, thresholdPct))}`);
        }
    }
    if (failCount === 0) {
        lines.push('');
        lines.push(chalk.green(formatSummary(passCount, failCount)));
    }
    else {
        lines.push('');
        lines.push(chalk.red(formatSummary(passCount, failCount)));
    }
    return { output: lines.join('\n'), failCount };
}
export function formatCaptureDone(outPath) {
    return chalk.green(`Snapshot saved: ${outPath}`);
}
export function formatBaselineUpdateDone(updated) {
    const lines = ['Updating baselines...'];
    for (const entry of updated) {
        lines.push(`  ${chalk.green('✓')} ${chalk.cyan(entry.selector)} -> ${entry.path} updated`);
    }
    lines.push(`${updated.length} baselines updated.`);
    return lines.join('\n');
}
