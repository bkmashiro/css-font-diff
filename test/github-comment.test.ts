import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  buildDiffMarkdownTable,
  readGitHubContext,
  upsertDiffComment,
} from '../src/github-comment.ts'
import type { RegionDiffResult } from '../src/diff.ts'

const sampleResults: RegionDiffResult[] = [
  {
    selector: '.hero-title',
    diffPercent: 0,
    baseline: 'baseline',
    compare: 'compare',
    missing: false,
  },
  {
    selector: '.body-text',
    diffPercent: 3.2,
    baseline: 'baseline',
    compare: 'compare',
    missing: false,
  },
  {
    selector: '.nav-link',
    diffPercent: 0,
    baseline: 'baseline',
    compare: 'compare',
    missing: true,
  },
]

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

test('buildDiffMarkdownTable renders a markdown report with summary counts', () => {
  const markdown = buildDiffMarkdownTable(sampleResults, 1)

  assert.match(markdown, /## 🔤 Font Diff Report/)
  assert.match(markdown, /\| \.hero-title \| ✅ Pass \| 0\.0% \|/)
  assert.match(markdown, /\| \.body-text \| ❌ Fail \| 3\.2% \|/)
  assert.match(markdown, /\| \.nav-link \| ⚠️ Missing \| N\/A \|/)
  assert.match(markdown, /1 passed, 1 failed, 1 missing/)
})

test('readGitHubContext reads the pull request number from GITHUB_EVENT_PATH', () => {
  const eventPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'css-font-diff-gh-')), 'event.json')
  fs.writeFileSync(eventPath, JSON.stringify({ pull_request: { number: 42 } }), 'utf-8')

  const context = readGitHubContext({
    GITHUB_TOKEN: 'token',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_EVENT_PATH: eventPath,
  })

  assert.deepEqual(context, {
    token: 'token',
    repository: 'owner/repo',
    prNumber: 42,
  })
})

test('upsertDiffComment creates a new comment when no report exists', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })

    if (calls.length === 1) {
      return createJsonResponse([])
    }

    return createJsonResponse({ id: 1001 })
  }

  const result = await upsertDiffComment(
    sampleResults,
    1,
    {
      GITHUB_TOKEN: 'token',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_PR_NUMBER: '42',
    },
    fetchMock
  )

  assert.equal(result.prNumber, 42)
  assert.equal(result.updated, false)
  assert.equal(calls[0]?.url, 'https://api.github.com/repos/owner/repo/issues/42/comments')
  assert.equal(calls[0]?.init?.method, 'GET')
  assert.equal(calls[1]?.init?.method, 'POST')
  assert.match(String(calls[1]?.init?.body), /## 🔤 Font Diff Report/)
})

test('upsertDiffComment updates an existing report comment', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchMock: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init })

    if (calls.length === 1) {
      return createJsonResponse([{ id: 99, body: '<!-- css-font-diff-report -->\nold body' }])
    }

    return createJsonResponse({ id: 99 })
  }

  const result = await upsertDiffComment(
    sampleResults,
    1,
    {
      GITHUB_TOKEN: 'token',
      GITHUB_REPOSITORY: 'owner/repo',
      GITHUB_PR_NUMBER: '42',
    },
    fetchMock
  )

  assert.equal(result.updated, true)
  assert.equal(calls[1]?.url, 'https://api.github.com/repos/owner/repo/issues/comments/99')
  assert.equal(calls[1]?.init?.method, 'PATCH')
})
