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
pr_body_file="docs/pull-request-draft.md"
dirty="$(git status --short)"

repo_url="$(
  sed -n 's/^[[:space:]]*"url":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
    head -n 1
)"
issue_identifier=""
if [[ "$branch" =~ ([A-Za-z]+-[0-9]+) ]]; then
  issue_identifier="${BASH_REMATCH[1]^^}"
else
  issue_identifier="$(
    sed -n 's/^[[:space:]]*"starter_issue_identifier":[[:space:]]*"\([^"]*\)".*/\1/p' "$repo_root/.bootstrap/project.json" |
      head -n 1
  )"
fi
if [[ -z "$repo_url" ]]; then
  echo "Could not determine the GitHub repo URL from .bootstrap/project.json." >&2
  exit 1
fi
if [[ -z "$issue_identifier" ]]; then
  echo "Could not determine an issue identifier from the current branch or .bootstrap/project.json." >&2
  exit 1
fi

derive_pr_title() {
  if [[ -n "${PR_TITLE-}" ]]; then
    printf '%s\n' "$PR_TITLE"
    return
  fi

  local draft_title
  local branch_slug
  local issue_prefix

  draft_title="$(
    sed -n 's/^<!--[[:space:]]*PR_TITLE:[[:space:]]*\(.*[^[:space:]]\)[[:space:]]*-->$/\1/p' "$pr_body_file" |
      head -n 1
  )"

  if [[ -n "$draft_title" ]]; then
    printf '%s\n' "$draft_title"
    return
  fi

  branch_slug="${branch##*/}"
  issue_prefix="${issue_identifier,,}-"

  if [[ "${branch_slug,,}" == "$issue_prefix"* ]]; then
    branch_slug="${branch_slug:${#issue_prefix}}"
  fi

  branch_slug="${branch_slug//-/ }"
  branch_slug="${branch_slug//_/ }"
  branch_slug="$(
    printf '%s' "$branch_slug" |
      sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//'
  )"

  if [[ -n "$branch_slug" ]]; then
    printf '%s\n' "${branch_slug^}"
    return
  fi

  printf 'Update %s\n' "$issue_identifier"
}

pr_title="$(derive_pr_title)"

origin_url="$(git remote get-url origin 2>/dev/null || true)"
default_handoff_dir="${HANDOFF_DIR:-$repo_root/.handoff/$issue_identifier}"

prepare_handoff_fallback() {
  local reason="$1"
  local handoff_output
  local bundle_path
  local manifest_path

  echo "$reason" >&2

  if ! handoff_output="$(./scripts/prepare-handoff.sh "$default_handoff_dir")"; then
    echo "Offline handoff preparation also failed." >&2
    return 1
  fi

  printf '%s\n' "$handoff_output" >&2
  bundle_path="$(printf '%s\n' "$handoff_output" | awk -F': ' '/^Bundle:/ {print $2; exit}')"
  manifest_path="$(printf '%s\n' "$handoff_output" | awk -F': ' '/^Manifest:/ {print $2; exit}')"

  if [[ -z "$bundle_path" ]]; then
    echo "Could not determine the handoff bundle path." >&2
    return 1
  fi

  if [[ -z "$manifest_path" ]]; then
    echo "Could not determine the handoff manifest path." >&2
    return 1
  fi

  echo "To verify the fallback handoff locally:" >&2
  echo "  npm run handoff:verify -- $manifest_path" >&2
  echo "To import the fallback bundle into another clone:" >&2
  echo "  git -C <target-repo-dir> fetch $bundle_path $branch:$branch" >&2
  echo "  git -C <target-repo-dir> switch $branch" >&2
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
echo "Using PR title: $pr_title"
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
  echo "Would prepare offline handoff directory on auth/DNS/HTTPS failure at: $default_handoff_dir"
  echo "Dry run enabled; no network requests will be made."
  echo "Would run: git push -u origin HEAD"
  echo "Would inspect PR state with: gh pr list --head $branch --state all --json number,state,url"
  echo "Would create a PR with: gh pr create --head $branch --title \"$pr_title\" --body-file $pr_body_file"
  echo "Would update an existing PR with: gh pr edit <number> --title \"$pr_title\" --body-file $pr_body_file"
  echo "Would use body file: $pr_body_file"
  exit 0
fi

npm test
npm run build

if ! gh auth status >/dev/null 2>&1; then
  prepare_handoff_fallback "GitHub auth is not ready. Run 'gh auth status' for details."
fi

if ! python3 -c "import socket; socket.getaddrinfo('github.com', 443)" >/dev/null 2>&1; then
  prepare_handoff_fallback "GitHub DNS resolution failed. Check outbound network access."
fi

if command -v curl >/dev/null 2>&1; then
  if ! curl --silent --show-error --output /dev/null --connect-timeout 5 https://github.com; then
    prepare_handoff_fallback "GitHub HTTPS reachability check failed. Check outbound network access."
  fi
fi

git push -u origin HEAD

existing_pr_number="$(
  gh pr list --head "$branch" --state all --json number --jq '.[0].number // empty'
)"
existing_pr_state="$(
  gh pr list --head "$branch" --state all --json state --jq '.[0].state // empty'
)"

if [[ "$existing_pr_state" == "MERGED" || "$existing_pr_state" == "CLOSED" ]]; then
  echo "Current branch is tied to a closed PR; create a new branch first." >&2
  exit 1
fi

if [[ -z "$existing_pr_number" ]]; then
  gh pr create --head "$branch" --title "$pr_title" --body-file "$pr_body_file"
else
  gh pr edit "$existing_pr_number" --title "$pr_title" --body-file "$pr_body_file"
fi

gh pr list --head "$branch" --state open --json url --jq '.[0].url'
