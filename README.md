[![npm](https://img.shields.io/npm/v/css-font-diff)](https://www.npmjs.com/package/css-font-diff) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

# css-font-diff

**Detect cross-browser font rendering differences with pixel-level precision.**

Compare how fonts are rendered across browser versions, operating systems, or after CSS changes by capturing page snapshots and diffing them at the pixel level.

---

## Install

```bash
npm install -g css-font-diff
npx playwright install chromium
```

---

## Quick Start

```bash
# 1. Capture a baseline snapshot
css-font-diff capture --url https://example.com --name baseline

# 2. Make your CSS/font changes, then capture a comparison
css-font-diff capture --url https://example.com --name after-change

# 3. Diff the two snapshots
css-font-diff diff --baseline baseline --compare after-change
```

---

## Commands

### `css-font-diff capture`

Launches a headless Chromium browser, navigates to the URL, and screenshots the page (or a specific element).

| Option | Default | Description |
|---|---|---|
| `--url <url>` | *(required)* | Page URL to capture |
| `--name <name>` | `snapshot` | Snapshot name (used as filename prefix) |
| `--selector <sel>` | `body` | CSS selector to screenshot |
| `--width <px>` | `1280` | Viewport width in pixels |
| `--baseline-update` | off | Rewrite `baseline-*` selector screenshots using configured selectors |
| `--update-baselines` | off | Alias for `--baseline-update` |

```bash
css-font-diff capture --url https://example.com --name v1 --selector "article" --width 1440
css-font-diff capture --url https://example.com --baseline-update
```

Snapshots are saved to `snapshots/<name>-chromium.png`.
Baseline updates save selector snapshots as `snapshots/baseline-<safe-selector>-chromium.png`.

---

### `css-font-diff diff`

Compares two named snapshots across a set of CSS selectors. Each selector's region is compared independently and a per-region diff percentage is reported.

| Option | Default | Description |
|---|---|---|
| `--baseline <name>` | *(required)* | Baseline snapshot name |
| `--compare <name>` | *(required)* | Comparison snapshot name |
| `--threshold <pct>` | `1.0` | Max allowed pixel diff % before failure |
| `--selectors <list>` | `h1,h2,h3,p,a,span` | Comma-separated selectors to compare |
| `--json` | off | Output results as JSON |
| `--ci-comment` | off | Create or update a GitHub PR comment with the diff report |

```bash
css-font-diff diff --baseline v1 --compare v2 --threshold 0.5
css-font-diff diff --baseline v1 --compare v2 --json
css-font-diff diff --baseline baseline --compare pr --ci-comment
```

Exit code is `1` if any region exceeds the threshold.
When `--ci-comment` is enabled, `GITHUB_TOKEN` and `GITHUB_REPOSITORY` must be set, and the PR number is read from `GITHUB_PR_NUMBER`, `GITHUB_EVENT_PATH`, or `GITHUB_REF`.

---

### `css-font-diff init`

Creates a `css-font-diff.config.json` file with default settings in the current directory.

```bash
css-font-diff init
```

**Default config:**

```json
{
  "defaultSelector": "body",
  "defaultWidth": 1280,
  "defaultThreshold": 1.0,
  "defaultSelectors": ["h1", "h2", "h3", "p", "a", "span"],
  "snapshotsDir": "snapshots"
}
```

---

## GitHub Action

```yaml
name: Font Regression Check

on:
  pull_request:

jobs:
  font-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start preview server
        run: npm run build && npm run preview &

      - name: Run css-font-diff
        uses: yuzhe/css-font-diff@v0.3.0
        with:
          url: http://localhost:3000
          baseline-name: baseline
          compare-name: compare
          selector: body
          threshold: "0.1"
          token: ${{ github.token }}
```

Inputs:

| Input | Default | Description |
|---|---|---|
| `baseline-name` | `baseline` | Snapshot name for baseline |
| `compare-name` | `compare` | Snapshot name for comparison |
| `url` | *(required)* | URL to capture |
| `threshold` | `0.1` | Diff threshold percentage |
| `selector` | `body` | CSS selector to capture and diff |
| `token` | `github.token` | GitHub token used for PR comments |

The action installs the package dependencies, captures baseline and comparison snapshots for the same URL and selector, and posts a PR comment when a GitHub token is available.

---

## How It Works

1. **Capture**: `css-font-diff capture` uses [Playwright](https://playwright.dev/) to launch a headless Chromium browser, navigate to the target URL, and take a screenshot of the specified element (or the full page). Screenshots are stored as PNG files in the `snapshots/` directory.

2. **Diff**: `css-font-diff diff` reads two PNG snapshots and uses [pixelmatch](https://github.com/mapbox/pixelmatch) to perform a pixel-level comparison. For each CSS selector, it calculates the percentage of pixels that differ between the baseline and comparison images.

3. **Report**: Results are printed with color-coded output showing the diff percentage per region and whether each region passed or failed the threshold. Use `--json` for machine-readable output suitable for CI integrations.

---

## License

MIT
