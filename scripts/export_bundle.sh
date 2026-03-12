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

safe_branch="${branch//\//-}"
bundle_path="${1:-/tmp/${repo_name}-${safe_branch}.bundle}"
head="$(git rev-parse HEAD)"

git bundle create "$bundle_path" "$branch"
git bundle verify "$bundle_path" >/dev/null

printf 'Bundle: %s\n' "$bundle_path"
printf 'Branch: %s\n' "$branch"
printf 'Head: %s\n' "$head"
