#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]]; then
  echo "Usage: ./scripts/prepare-handoff.sh [output-dir]" >&2
  exit 1
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

resolve_branch() {
  local branch_name

  branch_name="$(git branch --show-current 2>/dev/null || true)"
  if [[ -n "$branch_name" ]]; then
    printf '%s\n' "$branch_name"
    return 0
  fi

  for branch_name in "${GITHUB_HEAD_REF:-}" "${GITHUB_REF_NAME:-}" "${BRANCH_NAME:-}"; do
    if [[ -n "$branch_name" ]]; then
      printf '%s\n' "$branch_name"
      return 0
    fi
  done

  branch_name="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [[ -n "$branch_name" ]]; then
    printf '%s\n' "$branch_name"
    return 0
  fi

  return 1
}

if [[ -n "$(git status --short)" ]]; then
  echo "Working tree must be clean before preparing a handoff." >&2
  exit 1
fi

branch="$(resolve_branch || true)"
if [[ -z "$branch" ]]; then
  echo "Could not determine the current git branch." >&2
  exit 1
fi

head="$(git rev-parse HEAD)"
generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
generated_on="${generated_at%%T*}"

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
archive_name="${issue_identifier}-handoff.tar.gz"
checksums_name="SHA256SUMS"
resume_script_name="resume-handoff.sh"
bundle_path="$output_dir/$bundle_name"
pr_draft_path="$output_dir/pull-request-draft.md"
dry_run_path="$output_dir/publish-dry-run.txt"
summary_path="$output_dir/SUMMARY.md"
commits_path="$output_dir/commits.txt"
manifest_path="$output_dir/$manifest_name"
archive_path="$output_dir/$archive_name"
checksums_path="$output_dir/$checksums_name"
resume_script_path="$output_dir/$resume_script_name"

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

existing_blocker_snapshot=""
if [[ -z "${HANDOFF_BLOCKER_SNAPSHOT:-}" && -f "$summary_path" ]]; then
  existing_blocker_snapshot="$(
    awk '
      /^## Current blocker snapshot / { in_blocker=1; next }
      /^## / {
        if (in_blocker) {
          exit
        }
      }
      in_blocker { print }
    ' "$summary_path" | awk '
      NF { seen=1 }
      seen { lines[++count]=$0 }
      NF { last=count }
      END {
        for (i = 1; i <= last; i += 1) {
          print lines[i]
        }
      }
    '
  )"
fi

blocker_snapshot="${HANDOFF_BLOCKER_SNAPSHOT:-$existing_blocker_snapshot}"

./scripts/export_bundle.sh "$bundle_path" >/dev/null
cp docs/pull-request-draft.md "$pr_draft_path"
npm run pr:dry-run >"$dry_run_path"
git log --oneline -n 20 >"$commits_path"

pr_title="$(
  sed -n 's/^Would create a PR with: gh pr create --head .* --title "\(.*\)" --body-file .*$/\1/p' "$dry_run_path" |
    head -n 1
)"
pr_body_source="$(
  sed -n 's/^Would use body file: \(.*\)$/\1/p' "$dry_run_path" |
    head -n 1
)"

bundle_sha="$(sha256_file "$bundle_path")"
bundle_size="$(file_size "$bundle_path")"
pr_draft_sha="$(sha256_file "$pr_draft_path")"
pr_draft_size="$(file_size "$pr_draft_path")"
dry_run_sha="$(sha256_file "$dry_run_path")"
dry_run_size="$(file_size "$dry_run_path")"
commits_sha="$(sha256_file "$commits_path")"
commits_size="$(file_size "$commits_path")"

cat >"$resume_script_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if [[ \$# -lt 1 || \$# -gt 3 ]]; then
  echo "Usage: \$(basename "\$0") <target-repo-dir> [--validate] [--dry-run-publish]" >&2
  exit 1
fi

target_repo="\$1"
run_publish_dry_run=false
run_validate=false

shift

for arg in "\$@"; do
  case "\$arg" in
    --dry-run-publish)
      run_publish_dry_run=true
      ;;
    --validate)
      run_validate=true
      ;;
    *)
      echo "Unknown option: \$arg" >&2
      echo "Usage: \$(basename "\$0") <target-repo-dir> [--validate] [--dry-run-publish]" >&2
      exit 1
      ;;
  esac
done

handoff_dir="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
manifest_path="\$handoff_dir/${manifest_name}"

if [[ ! -f "\$manifest_path" ]]; then
  echo "Manifest not found: \$manifest_path" >&2
  exit 1
fi

if [[ ! -d "\$target_repo/.git" ]]; then
  echo "Target repo is not a git checkout: \$target_repo" >&2
  exit 1
fi

if [[ -n "\$(git -C "\$target_repo" status --short)" ]]; then
  echo "Target repo working tree must be clean before restoring the handoff: \$target_repo" >&2
  exit 1
fi

node - "\$manifest_path" <<'NODE'
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(process.argv[2]);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

for (const artifact of manifest.artifacts) {
  const artifactPath = path.join(manifestDir, artifact.path);
  const content = fs.readFileSync(artifactPath);
  const digest = crypto.createHash("sha256").update(content).digest("hex");

  if (digest !== artifact.sha256) {
    throw new Error(
      \`SHA mismatch for \${artifact.name}: expected \${artifact.sha256}, got \${digest}\`
    );
  }

  const fileStat = fs.statSync(artifactPath);
  if (fileStat.size !== artifact.size) {
    throw new Error(
      \`Size mismatch for \${artifact.name}: expected \${artifact.size}, got \${fileStat.size}\`
    );
  }
}
NODE

bundle_info="\$(
  node - "\$manifest_path" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(process.argv[2]);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const bundle = manifest.artifacts.find((artifact) => artifact.name === "bundle");

if (!bundle) {
  throw new Error("Bundle artifact missing from manifest.");
}

process.stdout.write(JSON.stringify({
  branch: manifest.branch,
  bundlePath: path.join(manifestDir, bundle.path),
  head: manifest.head
}));
NODE
)"

branch="\$(
  node -e 'const info = JSON.parse(process.argv[1]); process.stdout.write(info.branch);' "\$bundle_info"
)"
bundle_path="\$(
  node -e 'const info = JSON.parse(process.argv[1]); process.stdout.write(info.bundlePath);' "\$bundle_info"
)"
head="\$(
  node -e 'const info = JSON.parse(process.argv[1]); process.stdout.write(info.head);' "\$bundle_info"
)"

current_branch="\$(git -C "\$target_repo" branch --show-current)"

if [[ "\$current_branch" == "\$branch" ]]; then
  git -C "\$target_repo" fetch "\$bundle_path" "\$branch"
  git -C "\$target_repo" reset --hard FETCH_HEAD >/dev/null
else
  git -C "\$target_repo" fetch "\$bundle_path" "\$branch:\$branch"
  git -C "\$target_repo" switch "\$branch"
fi

printf 'Verified handoff artifacts from: %s\n' "\$handoff_dir"
printf 'Imported branch: %s\n' "\$branch"
printf 'Target repo: %s\n' "\$target_repo"
printf 'Expected head: %s\n' "\$head"
printf 'Current head: %s\n' "\$(git -C "\$target_repo" rev-parse HEAD)"

if \$run_validate; then
  (
    cd "\$target_repo"
    npm run check
  )
fi

if \$run_publish_dry_run; then
  (
    cd "\$target_repo"
    npm run pr:dry-run
  )
fi

printf 'Next step in %s: npm run pr:publish\n' "\$target_repo"
EOF
chmod 755 "$resume_script_path"

resume_script_sha="$(sha256_file "$resume_script_path")"
resume_script_size="$(file_size "$resume_script_path")"

cat >"$summary_path" <<EOF
# ${issue_identifier} Handoff Summary

- Repo: ${repo_slug}
- Repo URL: ${repo_url}
- Branch: ${branch}
- Head: ${head}
- Generated at: ${generated_at}
- PR title: ${pr_title:-<see publish-dry-run.txt>}
- PR body source: ${pr_body_source:-docs/pull-request-draft.md}
- Verified bundle: ${bundle_name}
- Bundle SHA-256: ${bundle_sha}
- Resume helper: ${resume_script_name}
- Checksums: ${checksums_name}
- Packaged archive: ${archive_name}

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
   Manual fallback title: \`${pr_title:-see publish-dry-run.txt}\`
   Manual fallback body: \`${pr_body_source:-docs/pull-request-draft.md}\`
EOF

if [[ -n "$blocker_snapshot" ]]; then
  cat >>"$summary_path" <<EOF

## Current blocker snapshot (${generated_on})

${blocker_snapshot}
EOF
fi

cat >>"$summary_path" <<EOF

## Included artifacts

- \`${bundle_name}\`
- \`pull-request-draft.md\`
- \`publish-dry-run.txt\`
- \`commits.txt\`
- \`${manifest_name}\`
- \`${resume_script_name}\`
- \`${checksums_name}\`
- \`${archive_name}\`
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
    },
    {
      "name": "resume_script",
      "path": "${resume_script_name}",
      "sha256": "${resume_script_sha}",
      "size": ${resume_script_size}
    }
  ]
}
EOF

{
  for artifact in \
    "${bundle_name}" \
    "pull-request-draft.md" \
    "publish-dry-run.txt" \
    "commits.txt" \
    "SUMMARY.md" \
    "${manifest_name}" \
    "${resume_script_name}"; do
    printf '%s  %s\n' "$(sha256_file "$output_dir/$artifact")" "$artifact"
  done
} >"$checksums_path"

tar -czf "$archive_path" \
  -C "$output_dir" \
  "${bundle_name}" \
  "publish-dry-run.txt" \
  "SUMMARY.md" \
  "pull-request-draft.md" \
  "${manifest_name}" \
  "${checksums_name}" \
  "commits.txt" \
  "${resume_script_name}"

printf 'Handoff directory: %s\n' "$output_dir"
printf 'Bundle: %s\n' "$bundle_path"
printf 'Manifest: %s\n' "$manifest_path"
printf 'Resume script: %s\n' "$resume_script_path"
printf 'Checksums: %s\n' "$checksums_path"
printf 'Archive: %s\n' "$archive_path"
printf 'Bundle SHA-256: %s\n' "$bundle_sha"
