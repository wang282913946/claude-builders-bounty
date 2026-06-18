#!/usr/bin/env bash
# changelog.sh - Generate CHANGELOG.md from git history
# Usage: bash changelog.sh [--stdout] [--tag=TAG] [--help]

set -euo pipefail

VERSION="1.0.0"
SCRIPT_NAME="$(basename "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
STDOUT=false
CUSTOM_TAG=""

show_help() {
    cat <<EOF
${CYAN}$SCRIPT_NAME${NC} v${VERSION} - Generate CHANGELOG.md from git history

${YELLOW}Usage:${NC}
    bash $SCRIPT_NAME [options]

${YELLOW}Options:${NC}
    --stdout           Print to stdout instead of writing CHANGELOG.md
    --tag=TAG          Use specific tag as starting point
    --help, -h         Show this help

${YELLOW}Examples:${NC}
    bash $SCRIPT_NAME                    # Generate CHANGELOG.md
    bash $SCRIPT_NAME --stdout           # Print to stdout
    bash $SCRIPT_NAME --tag=v1.0.0       # From specific tag

${YELLOW}Output:${NC}
    - Auto-categorized into Added, Fixed, Changed, Removed, Other
    - Conventional commit support (feat:, fix:, refactor:, etc.)
    - Keep a Changelog format
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
    case $1 in
        --stdout) STDOUT=true; shift ;;
        --tag=*) CUSTOM_TAG="${1#*=}"; shift ;;
        --help|-h) show_help; exit 0 ;;
        *) echo -e "${RED}Unknown option: $1${NC}" >&2; exit 1 ;;
    esac
done

# Check if in git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}" >&2
    exit 1
fi

# Determine starting point
if [[ -n "$CUSTOM_TAG" ]]; then
    START_REF="$CUSTOM_TAG"
elif git describe --tags --abbrev=0 >/dev/null 2>&1; then
    START_REF="$(git describe --tags --abbrev=0)"
else
    START_REF=""
fi

# Get commits
if [[ -n "$START_REF" ]]; then
    COMMITS=$(git log --pretty=format:"%H|%s|%an|%ad" --date=short "$START_REF"..HEAD 2>/dev/null)
    TAG_INFO="since $START_REF"
else
    COMMITS=$(git log --pretty=format:"%H|%s|%an|%ad" --date=short 2>/dev/null)
    TAG_INFO="all history"
fi

TOTAL=$(echo "$COMMITS" | grep -c "|" || echo 0)

# Generate output
OUTPUT=""
OUTPUT+="# Changelog\n\n"
OUTPUT+="All notable changes to this project will be documented in this file.\n\n"
OUTPUT+="The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).\n\n"

if [[ -n "$START_REF" ]]; then
    OUTPUT+="## [${START_REF}] - $(date +%Y-%m-%d)\n\n"
else
    OUTPUT+="## [Unreleased]\n\n"
fi

OUTPUT+="_${TOTAL} commits ${TAG_INFO}_\n\n"

# Categorize commits
declare -A CATEGORIES
CATEGORIES[Added]=""
CATEGORIES[Changed]=""
CATEGORIES[Fixed]=""
CATEGORIES[Removed]=""
CATEGORIES[Other]=""

while IFS='|' read -r hash subject author date; do
    [[ -z "$hash" ]] && continue
    SHORT_HASH="${hash:0:7}"
    
    # Categorize based on conventional commit prefix
    category="Other"
    clean_subject="$subject"
    
    if [[ "$subject" =~ ^feat(\(.+\))?:\ (.+)$ ]]; then
        category="Added"
        clean_subject="${BASH_REMATCH[2]}"
    elif [[ "$subject" =~ ^fix(\(.+\))?:\ (.+)$ ]]; then
        category="Fixed"
        clean_subject="${BASH_REMATCH[2]}"
    elif [[ "$subject" =~ ^(refactor|perf|style|docs|test|chore|build|ci)(\(.+\))?:\ (.+)$ ]]; then
        category="Changed"
        clean_subject="${BASH_REMATCH[3]}"
    elif [[ "$subject" =~ ^(remove|delete|deprecate)(\(.+\))?:\ (.+)$ ]]; then
        category="Removed"
        clean_subject="${BASH_REMATCH[3]}"
    fi
    
    # Capitalize first letter for Keep a Changelog format
    first_char="${clean_subject:0:1}"
    rest="${clean_subject:1}"
    case "$first_char" in
        [a-z]) first_char=$(echo "$first_char" | tr '[:lower:]' '[:upper:]') ;;
    esac
    formatted="${first_char}${rest}"
    
    CATEGORIES[$category]+="- $formatted (${SHORT_HASH})\n"
done <<< "$COMMITS"

# Append categorized sections
for cat in Added Changed Fixed Removed Other; do
    if [[ -n "${CATEGORIES[$cat]}" ]]; then
        case $cat in
            Added) OUTPUT+="### 🚀 Added\n\n" ;;
            Changed) OUTPUT+="### 🔧 Changed\n\n" ;;
            Fixed) OUTPUT+="### 🐛 Fixed\n\n" ;;
            Removed) OUTPUT+="### 🗑️ Removed\n\n" ;;
            Other) OUTPUT+="### 📝 Other\n\n" ;;
        esac
        OUTPUT+="${CATEGORIES[$cat]}\n"
    fi
done

# Stats
OUTPUT+="\n---\n"
OUTPUT+="_Generated on $(date +%Y-%m-%d) by $SCRIPT_NAME v${VERSION}_\n"

# Output
if [[ "$STDOUT" == "true" ]]; then
    echo -e "$OUTPUT"
else
    # Preserve existing changelog if it exists
    if [[ -f CHANGELOG.md ]]; then
        echo -e "${YELLOW}Note: Existing CHANGELOG.md found, backing up to CHANGELOG.md.bak${NC}"
        cp CHANGELOG.md CHANGELOG.md.bak
    fi
    echo -e "$OUTPUT" > CHANGELOG.md
    echo -e "${GREEN}✅ Generated CHANGELOG.md (${TOTAL} commits)${NC}"
fi