import fs from 'node:fs';
const REPORT_MARKER = '<!-- css-font-diff-report -->';
const REPORT_TITLE = '## 🔤 Font Diff Report';
const GITHUB_API_BASE = 'https://api.github.com';
export function buildDiffMarkdownTable(results, thresholdPct) {
    let passCount = 0;
    let failCount = 0;
    let missingCount = 0;
    const rows = results.map((result) => {
        if (result.missing) {
            missingCount++;
            return `| ${result.selector} | ⚠️ Missing | N/A |`;
        }
        if (result.diffPercent > thresholdPct) {
            failCount++;
            return `| ${result.selector} | ❌ Fail | ${result.diffPercent.toFixed(1)}% |`;
        }
        passCount++;
        return `| ${result.selector} | ✅ Pass | ${result.diffPercent.toFixed(1)}% |`;
    });
    const summary = [`${passCount} passed, ${failCount} failed`];
    if (missingCount > 0) {
        summary.push(`${missingCount} missing`);
    }
    return [
        REPORT_MARKER,
        REPORT_TITLE,
        '',
        '| Selector | Status | Diff % |',
        '|----------|--------|--------|',
        ...rows,
        '',
        summary.join(', '),
    ].join('\n');
}
export function readGitHubContext(env = process.env) {
    const token = env.GITHUB_TOKEN;
    const repository = env.GITHUB_REPOSITORY;
    const prNumber = readPrNumber(env);
    if (!token) {
        throw new Error('GITHUB_TOKEN is required for --ci-comment');
    }
    if (!repository) {
        throw new Error('GITHUB_REPOSITORY is required for --ci-comment');
    }
    if (!prNumber) {
        throw new Error('Pull request number not found. Set GITHUB_PR_NUMBER or provide GITHUB_EVENT_PATH/GITHUB_REF.');
    }
    return { token, repository, prNumber };
}
function readPrNumber(env) {
    const explicitValue = env.GITHUB_PR_NUMBER ?? env.PR_NUMBER;
    const explicitNumber = parsePositiveInt(explicitValue);
    if (explicitNumber) {
        return explicitNumber;
    }
    const refMatch = env.GITHUB_REF?.match(/^refs\/pull\/(\d+)\/(?:head|merge)$/);
    if (refMatch) {
        return parsePositiveInt(refMatch[1]);
    }
    const eventPath = env.GITHUB_EVENT_PATH;
    if (!eventPath || !fs.existsSync(eventPath)) {
        return undefined;
    }
    try {
        const raw = fs.readFileSync(eventPath, 'utf-8');
        const payload = JSON.parse(raw);
        return parsePositiveInt(String(payload.pull_request?.number ?? payload.number ?? ''));
    }
    catch {
        return undefined;
    }
}
function parsePositiveInt(value) {
    if (!value) {
        return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
async function githubRequest(url, init, fetchImpl) {
    const response = await fetchImpl(url, init);
    if (!response.ok) {
        throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }
    return response;
}
export async function upsertDiffComment(results, thresholdPct, env = process.env, fetchImpl = fetch) {
    const context = readGitHubContext(env);
    const body = buildDiffMarkdownTable(results, thresholdPct);
    const headers = {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'css-font-diff',
    };
    const commentsUrl = `${GITHUB_API_BASE}/repos/${context.repository}/issues/${context.prNumber}/comments`;
    const commentsResponse = await githubRequest(commentsUrl, { headers, method: 'GET' }, fetchImpl);
    const comments = (await commentsResponse.json());
    const existing = comments.find((comment) => comment.body.includes(REPORT_MARKER));
    if (existing) {
        const updateUrl = `${GITHUB_API_BASE}/repos/${context.repository}/issues/comments/${existing.id}`;
        await githubRequest(updateUrl, { headers, method: 'PATCH', body: JSON.stringify({ body }) }, fetchImpl);
        return { body, prNumber: context.prNumber, updated: true };
    }
    await githubRequest(commentsUrl, { headers, method: 'POST', body: JSON.stringify({ body }) }, fetchImpl);
    return { body, prNumber: context.prNumber, updated: false };
}
