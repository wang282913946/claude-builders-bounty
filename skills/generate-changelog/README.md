# generate-changelog

Auto-generate `CHANGELOG.md` from git commit history with smart categorization and conventional commit support.

## Features

- 📝 **Smart commit parsing** since last git tag
- 🏷️ **Auto-categorization**: Added, Fixed, Changed, Removed, Other
- 📋 **Conventional commits support**: `feat:`, `fix:`, `refactor:`, `chore:`, `perf:`, `docs:`, `style:`, `test:`
- ✅ **Keep a Changelog format** compliant
- 💾 **Preserves existing changelog** (backs up to `CHANGELOG.md.bak`)
- 🎨 **Colored output** and summary stats
- 🔌 **Zero dependencies** - pure bash + git

## Installation

### Option 1: Standalone Script

```bash
curl -sLO https://raw.githubusercontent.com/your-repo/main/changelog.sh
chmod +x changelog.sh
./changelog.sh
```

### Option 2: Claude Code Skill

1. Copy `skills/generate-changelog/` to `~/.claude/skills/`
2. Restart Claude Code
3. Run `/generate-changelog` command

## Usage

### Basic

```bash
bash scripts/changelog.sh
```

Generates `CHANGELOG.md` in current directory.

### Print to stdout

```bash
bash scripts/changelog.sh --stdout
```

### From specific tag

```bash
bash scripts/changelog.sh --tag=v1.0.0
```

### Help

```bash
bash scripts/changelog.sh --help
```

## Example Output

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [v1.0.0] - 2026-06-18

_42 commits since beginning_

### 🚀 Added
- Add user authentication with OAuth2 (a1b2c3d)
- Add rate limiter with token bucket (e4f5g6h)

### 🐛 Fixed
- Fix memory leak in cache (i7j8k9l)

### 🔧 Changed
- Refactor database connection pool (m0n1o2p)
```

## Configuration

No configuration needed. The script auto-detects:
- Last git tag (or uses full history if no tags)
- Conventional commit prefixes
- Date format

## License

MIT