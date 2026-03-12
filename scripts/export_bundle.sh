#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="$(git branch --show-current)"
if [[ -z "$branch" ]]; then
  echo "Could not determine the current git branch." >&2
  exit 1
fi

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree must be clean before exporting a bundle." >&2
  exit 1
fi

repo_name="$(
  sed -n 's/^[[:space:]]*"slug":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
    head -n 1
)"
if [[ -z "$repo_name" ]]; then
  repo_name="$(basename "$repo_root")"
fi

issue_identifier=""
if [[ "$branch" =~ ([A-Za-z]+-[0-9]+) ]]; then
  issue_identifier="${BASH_REMATCH[1]^^}"
else
  issue_identifier="$(
    sed -n 's/^[[:space:]]*"starter_issue_identifier":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
      head -n 1
  )"
fi

safe_branch="${branch//\//-}"
default_bundle_dir="/tmp"
if [[ -n "$issue_identifier" ]]; then
  default_bundle_dir="$repo_root/.handoff/$issue_identifier"
fi

bundle_path="${1:-$default_bundle_dir/${repo_name}-${safe_branch}.bundle}"
head="$(git rev-parse HEAD)"

mkdir -p "$(dirname "$bundle_path")"

git bundle create "$bundle_path" "$branch"
git bundle verify "$bundle_path" >/dev/null

printf 'Bundle: %s\n' "$bundle_path"
printf 'Branch: %s\n' "$branch"
printf 'Head: %s\n' "$head"
