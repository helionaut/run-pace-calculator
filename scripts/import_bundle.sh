#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: scripts/import_bundle.sh <bundle-path> <target-repo-dir>" >&2
  exit 1
fi

bundle_path="$1"
target_repo="$2"

if [[ ! -f "$bundle_path" ]]; then
  echo "Bundle not found: $bundle_path" >&2
  exit 1
fi

if [[ ! -d "$target_repo/.git" ]]; then
  echo "Target repo is not a git checkout: $target_repo" >&2
  exit 1
fi

branch="$(
  git bundle list-heads "$bundle_path" |
    awk '$2 ~ /^refs\/heads\// {sub("refs/heads/", "", $2); print $2; exit}'
)"
if [[ -z "$branch" ]]; then
  echo "Could not determine a branch ref from bundle: $bundle_path" >&2
  exit 1
fi

git -C "$target_repo" fetch "$bundle_path" "$branch:$branch"

printf 'Imported branch: %s\n' "$branch"
printf 'Target repo: %s\n' "$target_repo"
printf 'Head: %s\n' "$(git -C "$target_repo" rev-parse "$branch")"
