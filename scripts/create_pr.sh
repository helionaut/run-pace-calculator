#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

dry_run=false
if [[ "${1-}" == "--dry-run" ]]; then
  dry_run=true
elif [[ "${1-}" != "" ]]; then
  echo "Usage: scripts/create_pr.sh [--dry-run]" >&2
  exit 1
fi

branch="$(git branch --show-current)"
pr_title="Build the first Run Pace Calculator slice"
pr_body_file="docs/pull-request-draft.md"
dirty="$(git status --short)"

repo_url="$(
  sed -n 's/^[[:space:]]*"url":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
    head -n 1
)"
if [[ -z "$repo_url" ]]; then
  echo "Could not determine the GitHub repo URL from .bootstrap/project.json." >&2
  exit 1
fi

origin_url="$(git remote get-url origin 2>/dev/null || true)"
safe_branch="${branch//\//-}"
repo_name="$(
  sed -n 's/^[[:space:]]*"slug":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
    head -n 1
)"
if [[ -z "$repo_name" ]]; then
  repo_name="$(basename "$repo_root")"
fi
default_bundle_path="${BUNDLE_PATH:-/tmp/${repo_name}-${safe_branch}.bundle}"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return
  fi

  return 1
}

export_bundle_fallback() {
  local reason="$1"
  local bundle_output
  local bundle_path
  local bundle_sha

  echo "$reason" >&2

  if [[ -n "${BUNDLE_PATH-}" ]]; then
    if ! bundle_output="$(./scripts/export_bundle.sh "$BUNDLE_PATH")"; then
      echo "Offline bundle export also failed." >&2
      return 1
    fi
  else
    if ! bundle_output="$(./scripts/export_bundle.sh)"; then
      echo "Offline bundle export also failed." >&2
      return 1
    fi
  fi

  printf '%s\n' "$bundle_output" >&2
  bundle_path="$(printf '%s\n' "$bundle_output" | awk -F': ' '/^Bundle:/ {print $2; exit}')"
  if [[ -z "$bundle_path" ]]; then
    echo "Could not determine the exported bundle path." >&2
    return 1
  fi

  if bundle_sha="$(sha256_file "$bundle_path")"; then
    echo "Bundle SHA-256: $bundle_sha" >&2
  else
    echo "Bundle SHA-256: unavailable (sha256 tool not found)." >&2
  fi

  echo "To import the fallback artifact into another clone:" >&2
  echo "  ./scripts/import_bundle.sh $bundle_path <target-repo-dir>" >&2
  return 1
}

if [[ ! -f "$pr_body_file" ]]; then
  echo "Missing PR body draft: $pr_body_file" >&2
  exit 1
fi

if [[ -n "$dirty" && "$dry_run" != true ]]; then
  echo "Working tree must be clean before publishing the PR." >&2
  exit 1
fi

if ! $dry_run && ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required to create the PR." >&2
  exit 1
fi

echo "Using branch: $branch"
echo "Using PR body: $pr_body_file"
echo "Current origin: ${origin_url:-<missing>}"

if [[ "$origin_url" != "$repo_url" && "$origin_url" != "${repo_url}.git" ]]; then
  if $dry_run; then
    echo "Would reset origin to: ${repo_url}.git"
  else
    git remote set-url origin "${repo_url}.git"
    echo "Reset origin to: ${repo_url}.git"
  fi
fi

if $dry_run; then
  echo "Would run validation: npm test"
  echo "Would run validation: npm run build"
  echo "Would verify GitHub auth with: gh auth status"
  echo "Would verify GitHub DNS with: python3 -c 'import socket; socket.getaddrinfo(\"github.com\", 443)'"
  echo "Would verify GitHub HTTPS with: curl --silent --show-error --output /dev/null --connect-timeout 5 https://github.com"
  echo "Would export offline bundle on auth/DNS/HTTPS failure to: $default_bundle_path"
  echo "Dry run enabled; no network requests will be made."
  echo "Would run: git push -u origin HEAD"
  echo "Would inspect PR state with: gh pr view --json state -q .state"
  echo "Would create or update PR titled: $pr_title"
  echo "Would use body file: $pr_body_file"
  exit 0
fi

npm test
npm run build

if ! gh auth status >/dev/null 2>&1; then
  export_bundle_fallback "GitHub auth is not ready. Run 'gh auth status' for details."
fi

if ! python3 -c "import socket; socket.getaddrinfo('github.com', 443)" >/dev/null 2>&1; then
  export_bundle_fallback "GitHub DNS resolution failed. Check outbound network access."
fi

if command -v curl >/dev/null 2>&1; then
  if ! curl --silent --show-error --output /dev/null --connect-timeout 5 https://github.com; then
    export_bundle_fallback "GitHub HTTPS reachability check failed. Check outbound network access."
  fi
fi

git push -u origin HEAD

pr_state="$(gh pr view --json state -q .state 2>/dev/null || true)"
if [[ "$pr_state" == "MERGED" || "$pr_state" == "CLOSED" ]]; then
  echo "Current branch is tied to a closed PR; create a new branch first." >&2
  exit 1
fi

if [[ -z "$pr_state" ]]; then
  gh pr create --title "$pr_title" --body-file "$pr_body_file"
else
  gh pr edit --title "$pr_title" --body-file "$pr_body_file"
fi

gh pr view --json url -q .url
