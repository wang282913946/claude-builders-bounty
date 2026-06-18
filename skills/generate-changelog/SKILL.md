---
name: generate-changelog
description: Generate a structured CHANGELOG.md from git history with auto-categorization, conventional commit support, and Keep a Changelog format compliance.
---

# generate-changelog

Auto-generate CHANGELOG.md from git commit history.

## Usage

```bash
bash scripts/changelog.sh
```

## Options

- `--stdout` - Print to stdout instead of writing CHANGELOG.md
- `--tag=TAG` - Use specific tag as starting point

## Features

- Smart commit parsing since last git tag
- Auto-categorization: Added, Fixed, Changed, Removed, Other
- Conventional commits support: feat:, fix:, refactor:, chore:, perf:, docs:, style:, test:
- Keep a Changelog format (https://keepachangelog.com/en/1.0.0/)
- Preserves existing changelog (backs up to CHANGELOG.md.bak)
- Colored output and summary stats

## Example Output

```markdown
# Changelog

## [Unreleased]

_15 commits since last release_

### 🚀 Added
- Add user authentication (a1b2c3d)
- Add rate limiter (e4f5g6h)

### 🐛 Fixed
- Fix memory leak in cache (i7j8k9l)
```

## Testing

Run `bash scripts/changelog.sh --stdout` to test on current repo.