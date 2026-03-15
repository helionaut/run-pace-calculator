#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: ./scripts/repair-shared-checkout.sh [--branch <branch>] [--repo-url <url>] [--target-dir <dir>]

Rebuild the shared checkout from the repo metadata in .bootstrap/project.json.
Override the repo URL, branch, or target directory when you need to repair a
different checkout during testing or maintenance.
EOF
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="main"
repo_url=""
target_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch)
      shift
      if [[ $# -eq 0 ]]; then
        usage
        exit 1
      fi
      branch="$1"
      ;;
    --repo-url)
      shift
      if [[ $# -eq 0 ]]; then
        usage
        exit 1
      fi
      repo_url="$1"
      ;;
    --target-dir)
      shift
      if [[ $# -eq 0 ]]; then
        usage
        exit 1
      fi
      target_dir="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac

  shift
done

mapfile -t repo_defaults < <(
  node - "$repo_root/.bootstrap/project.json" <<'EOF'
const fs = require("node:fs");

const projectPath = process.argv[2];
const project = JSON.parse(fs.readFileSync(projectPath, "utf8"));

console.log(project.repo?.url ?? "");
console.log(project.repo?.dir ?? "");
EOF
)

repo_url="${repo_url:-${repo_defaults[0]:-}}"
target_dir="${target_dir:-${repo_defaults[1]:-}}"

if [[ -z "$repo_url" || -z "$target_dir" ]]; then
  echo "Missing repo URL or target directory in .bootstrap/project.json." >&2
  exit 1
fi

target_dir="$(
  node -p "require('node:path').resolve(process.argv[1])" "$target_dir"
)"
target_parent="$(dirname "$target_dir")"
mkdir -p "$target_parent"

backup_path=""

restore_backup() {
  local exit_status=$?

  if [[ $exit_status -ne 0 && -n "$backup_path" && -e "$backup_path" ]]; then
    rm -rf "$target_dir"
    mv "$backup_path" "$target_dir"
    echo "Restored original checkout after failure: $target_dir" >&2
  fi

  exit "$exit_status"
}

trap restore_backup EXIT

if [[ -e "$target_dir" ]]; then
  backup_stamp="$(date -u +"%Y%m%dT%H%M%SZ")"
  backup_path="${target_dir}.backup.${backup_stamp}"

  while [[ -e "$backup_path" ]]; do
    backup_path="${target_dir}.backup.${backup_stamp}.$RANDOM"
  done

  mv "$target_dir" "$backup_path"
  printf 'Backed up existing checkout: %s\n' "$backup_path"
fi

printf 'Using repo URL: %s\n' "$repo_url"
printf 'Using branch: %s\n' "$branch"
printf 'Using target dir: %s\n' "$target_dir"

git clone --branch "$branch" "$repo_url" "$target_dir" >/dev/null
git -C "$target_dir" config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git -C "$target_dir" fetch origin --prune >/dev/null
git -C "$target_dir" reset --hard "origin/$branch" >/dev/null
git -C "$target_dir" clean -fd >/dev/null

trap - EXIT

printf 'Shared checkout: %s\n' "$target_dir"
printf 'Current branch: %s\n' "$(git -C "$target_dir" branch --show-current)"
printf 'Head: %s\n' "$(git -C "$target_dir" rev-parse HEAD)"
