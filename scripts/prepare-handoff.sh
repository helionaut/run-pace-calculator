#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: ./scripts/prepare-handoff.sh [output-dir]" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree must be clean before preparing a handoff." >&2
  exit 1
fi

branch="$(git branch --show-current)"
head="$(git rev-parse HEAD)"
generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

repo_slug="$(
  sed -n 's/^[[:space:]]*"slug":[[:space:]]*"\([^"]*\)".*/\1/p' .bootstrap/project.json |
    head -n 1
)"
repo_url="$(
  sed -n 's/^[[:space:]]*"url":[[:space:]]*"\([^"]*\)".*/\1/p' .bootstrap/project.json |
    head -n 1
)"

issue_identifier=""
if [[ "$branch" =~ ([A-Za-z]+-[0-9]+) ]]; then
  issue_identifier="${BASH_REMATCH[1]^^}"
else
  issue_identifier="$(
    sed -n 's/^[[:space:]]*"starter_issue_identifier":[[:space:]]*"\([^"]*\)".*/\1/p' .bootstrap/project.json |
      head -n 1
  )"
fi

if [[ -z "$repo_slug" || -z "$repo_url" || -z "$issue_identifier" ]]; then
  echo "Missing repo metadata or issue identifier for handoff preparation." >&2
  exit 1
fi

output_dir="${1:-$repo_root/.handoff/$issue_identifier}"
mkdir -p "$output_dir"

safe_branch="${branch//\//-}"
bundle_name="${repo_slug}-${safe_branch}.bundle"
manifest_name="${issue_identifier}-handoff-manifest.json"
bundle_path="$output_dir/$bundle_name"
pr_draft_path="$output_dir/pull-request-draft.md"
dry_run_path="$output_dir/publish-dry-run.txt"
summary_path="$output_dir/SUMMARY.md"
commits_path="$output_dir/commits.txt"
manifest_path="$output_dir/$manifest_name"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  shasum -a 256 "$1" | awk '{print $1}'
}

file_size() {
  if stat -c '%s' "$1" >/dev/null 2>&1; then
    stat -c '%s' "$1"
    return
  fi

  stat -f '%z' "$1"
}

for existing_bundle in "$output_dir"/"${repo_slug}"-*.bundle; do
  if [[ -e "$existing_bundle" && "$existing_bundle" != "$bundle_path" ]]; then
    rm -f "$existing_bundle"
  fi
done

./scripts/export_bundle.sh "$bundle_path" >/dev/null
cp docs/pull-request-draft.md "$pr_draft_path"
npm run pr:dry-run >"$dry_run_path"
git log --oneline -n 20 >"$commits_path"

bundle_sha="$(sha256_file "$bundle_path")"
bundle_size="$(file_size "$bundle_path")"
pr_draft_sha="$(sha256_file "$pr_draft_path")"
pr_draft_size="$(file_size "$pr_draft_path")"
dry_run_sha="$(sha256_file "$dry_run_path")"
dry_run_size="$(file_size "$dry_run_path")"
commits_sha="$(sha256_file "$commits_path")"
commits_size="$(file_size "$commits_path")"

cat >"$summary_path" <<EOF
# ${issue_identifier} Handoff Summary

- Repo: ${repo_slug}
- Repo URL: ${repo_url}
- Branch: ${branch}
- Head: ${head}
- Generated at: ${generated_at}
- Verified bundle: ${bundle_name}
- Bundle SHA-256: ${bundle_sha}

## Resume steps

The paths below use \`<handoff-dir>\` for the directory that contains this
summary, the manifest, and the exported bundle.

1. Clone or choose a writable checkout of the repo at \`<target-repo-dir>\`.
2. Import the bundle into that checkout with plain git:
   \`git -C <target-repo-dir> fetch <handoff-dir>/${bundle_name} ${branch}:${branch}\`
   \`git -C <target-repo-dir> switch ${branch}\`
3. Verify the copied handoff manifest from the repo root:
   \`node scripts/verify-handoff.mjs <handoff-dir>/${manifest_name}\`
4. Publish the branch and create or update the PR:
   \`npm run pr:publish\`

## Included artifacts

- \`${bundle_name}\`
- \`pull-request-draft.md\`
- \`publish-dry-run.txt\`
- \`commits.txt\`
- \`${manifest_name}\`
EOF

summary_sha="$(sha256_file "$summary_path")"
summary_size="$(file_size "$summary_path")"

cat >"$manifest_path" <<EOF
{
  "generatedAt": "${generated_at}",
  "issueIdentifier": "${issue_identifier}",
  "repo": {
    "slug": "${repo_slug}",
    "url": "${repo_url}"
  },
  "branch": "${branch}",
  "head": "${head}",
  "artifacts": [
    {
      "name": "bundle",
      "path": "${bundle_name}",
      "sha256": "${bundle_sha}",
      "size": ${bundle_size}
    },
    {
      "name": "pull_request_draft",
      "path": "pull-request-draft.md",
      "sha256": "${pr_draft_sha}",
      "size": ${pr_draft_size}
    },
    {
      "name": "publish_dry_run",
      "path": "publish-dry-run.txt",
      "sha256": "${dry_run_sha}",
      "size": ${dry_run_size}
    },
    {
      "name": "commits",
      "path": "commits.txt",
      "sha256": "${commits_sha}",
      "size": ${commits_size}
    },
    {
      "name": "summary",
      "path": "SUMMARY.md",
      "sha256": "${summary_sha}",
      "size": ${summary_size}
    }
  ]
}
EOF

printf 'Handoff directory: %s\n' "$output_dir"
printf 'Bundle: %s\n' "$bundle_path"
printf 'Manifest: %s\n' "$manifest_path"
printf 'Bundle SHA-256: %s\n' "$bundle_sha"
