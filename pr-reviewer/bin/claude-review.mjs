#!/usr/bin/env node
/**
 * claude-review — CLI PR reviewer that posts structured Markdown review comments.
 * Uses OpenRouter free models (gpt-oss-120b) when Anthropic Claude is unavailable.
 *
 * Usage:
 *   node bin/claude-review.mjs --pr OWNER/REPO/PULL_NUMBER
 *   node bin/claude-review.mjs --diff < diff.patch
 *   node bin/claude-review.mjs --url https://github.com/OWNER/REPO/pull/123
 */

import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

// ── Helpers ──────────────────────────────────────────────────────────
function log(...args) { console.log("[claude-review]", ...args); }
function die(msg) { console.error("[claude-review] ERROR:", msg); process.exit(1); }

// ── Parse args ───────────────────────────────────────────────────────
const args = process.argv.slice(2);
let prUrl = null;
let diffInput = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--pr" && args[i + 1]) {
    // OWNER/REPO/PULL_NUMBER
    const parts = args[++i].split("/");
    if (parts.length !== 3) die('PR arg must be OWNER/REPO/PULL_NUMBER (e.g. owner/repo/123)');
    prUrl = `${parts[0]}/${parts[1]}/${parts[2]}`;
  } else if (args[i] === "--url" && args[i + 1]) {
    const m = args[++i].match(/pull\/(\d+)/);
    if (!m) die("Could not extract PR number from URL");
    const parts = args[i].split("/").filter(Boolean);
    prUrl = `${parts[0]}/${parts[1]}/${m[1]}`;
  } else if (args[i] === "--diff" && args[i + 1]) {
    diffInput = args[++i];
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`Usage:
  claude-review --pr OWNER/REPO/PULL_NUMBER
  claude-review --url https://github.com/OWNER/REPO/pull/123
  claude-review --diff < diff.patch

Options:
  --pr OWNER/REPO/PULL_NUMBER   GitHub PR identifier
  --url URL                     Full PR URL (auto-extracts owner/repo/number)
  --diff PATH                   Path to a diff file (reads stdin if "-")
  --help                        Show this help

Output: Prints a structured Markdown review comment to stdout.
`);
    process.exit(0);
  }
}

if (!prUrl && !diffInput) {
  die("Missing --pr OWNER/REPO/PULL_NUMBER or --diff <diff_file>");
}

// ── Fetch PR data ────────────────────────────────────────────────────
async function fetchJson(url) {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const headers = { "Accept": "application/vnd.github.v3+json" };
  if (token) headers["Authorization"] = `token ${token}`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`GitHub API ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

// ── Build prompt ─────────────────────────────────────────────────────
function buildPrompt(prData, diffText) {
  const files = (prData.files || []).map(f => f.filename).join(", ");
  const title = prData.title || "Unknown PR";
  const body = prData.body || "(No description)";
  const additions = prData.additions || 0;
  const deletions = prData.deletions || 0;
  const changedFiles = prData.changed_files || 0;

  return `You are a senior software engineer reviewing a GitHub Pull Request.

## PR Info
- **Title**: ${title}
- **Description**: ${body}
- **Stats**: +${additions}/-${deletions} | ${changedFiles} file(s) changed
- **Files**: ${files}

## Diff
\`\`\`diff
${diffText}
\`\`\`

## Review Instructions
Provide a structured Markdown review comment with these sections:

### Summary of Changes (2-3 sentences)
Briefly describe what this PR does and why.

### Identified Risks
List potential issues (bugs, security, performance, breaking changes). If none, say "None identified."

### Improvement Suggestions
Code quality, readability, naming, error handling suggestions. Be constructive and specific.

### Confidence Score
Rate your confidence in this review:
- **High**: Clear changes, easy to evaluate
- **Medium**: Some ambiguity or complex logic
- **Low**: Very complex or unclear intent

### Overall Verdict
- ✅ **Approve** if changes look solid
- ⚠️ **Changes requested** if there are meaningful issues
- ℹ️ **Comment** if mostly fine but has minor notes

Be thorough but concise. Focus on what matters: correctness, security, maintainability.
`;
}

// ── Main ─────────────────────────────────────────────────────────────
(async () => {
  // Step 1: Get diff
  let diffText = "";
  if (diffInput) {
    diffText = diffInput === "-" ? process.stdin.read() : readFileSync(diffInput, "utf-8");
    if (!diffText) die("--diff file is empty");
  } else {
    log(`Fetching PR: ${prUrl}...`);
    const [owner, repo, prNum] = prUrl.split("/");
    const prData = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNum}`);
    let diffData = await fetchJson(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNum}/files`);
    diffData = Array.isArray(diffData) ? diffData : [];

    // Build unified diff from API files
    diffText = diffData.map(f => {
      if (f.patch) return f.patch;
      return `--- a/${f.filename}\n+++ b/${f.filename}\n@@ -0,0 +1,${f.additions} @@\n${f.additions > 0 ? f.additions : "(new file)"}`;
    }).join("\n");

    if (!diffText.trim()) die("PR has no diff or patch data");

    // Save PR data for later
    const prInfo = {
      title: prData.title,
      body: prData.body,
      additions: prData.additions,
      deletions: prData.deletions,
      changed_files: prData.changed_files,
      files: diffData.map(f => f.filename),
      base: prData.base.sha,
      head: prData.head.sha
    };
    writeFileSync(join(process.cwd(), ".claude-review-pr.json"), JSON.stringify(prInfo, null, 2));
    log(`PR info saved to .claude-review-pr.json`);
  }

  // Step 2: Build prompt
  const prompt = buildPrompt({ title: "", body: "", additions: 0, deletions: 0, changed_files: 0 }, diffText);

  // Step 3: Call OpenRouter API
  log("Calling OpenRouter API...");
  const model = process.env.CLAUDE_REVIEW_MODEL || "openai/gpt-oss-120b:free";
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) die("OPENROUTER_API_KEY environment variable is required");

  const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.3
    })
  });

  if (!resp.ok) {
    const err = await resp.text();
    die(`OpenRouter API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const review = data.choices?.[0]?.message?.content;
  if (!review) die("No review generated from API");

  // Step 4: Output
  console.log(review);
})();
