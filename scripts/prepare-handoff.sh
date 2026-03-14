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
capture_note_path="$output_dir/PREVIEW-CAPTURE.md"
preview_root_dir="$output_dir/previews"
preview_archive_path="$output_dir/preview-snapshots.tar"
bundled_verifier_path="$output_dir/verify-handoff.mjs"
resume_script_path="$output_dir/resume-from-handoff.sh"
preview_notes=""
demo_script=""
preview_before_ref="${HANDOFF_PREVIEW_BEFORE_REF:-}"
preview_after_ref="${HANDOFF_PREVIEW_AFTER_REF:-}"
preview_before_commit=""
preview_after_commit=""
capture_note_size=""
capture_note_sha=""
preview_archive_size=""
preview_archive_sha=""
bundled_verifier_size=""
bundled_verifier_sha=""
resume_script_size=""
resume_script_sha=""
optional_artifact_lines=""
optional_resume_step=""
optional_manifest_artifact=""

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

extract_markdown_section() {
  local heading="$1"
  local source_path="$2"

  awk -v heading="$heading" '
    BEGIN {
      pattern = "^## " heading "$"
    }
    $0 ~ pattern {capture=1; next}
    /^## / && capture {exit}
    capture {
      if (!started && $0 == "") {
        next
      }

      started=1
      lines[++count]=$0
    }
    END {
      while (count > 0 && lines[count] == "") {
        count--
      }

      for (i = 1; i <= count; i += 1) {
        print lines[i]
      }
    }
  ' "$source_path"
}

resolve_commit_ref() {
  git rev-parse "$1^{commit}"
}

build_preview_snapshot() {
  local ref="$1"
  local destination="$2"
  local worktree=""

  worktree="$(mktemp -d "${TMPDIR:-/tmp}/hel-16-preview.XXXXXX")"

  git archive "$ref" | tar -x -C "$worktree"

  (
    cd "$worktree"
    npm run build >/dev/null
  )

  mkdir -p "$destination"
  cp -R "$worktree/dist/." "$destination/"
  rm -rf "$worktree"
}

write_capture_note() {
  cat >"$capture_note_path" <<EOF
# ${issue_identifier} Preview Capture

- Before snapshot ref: \`${preview_before_commit}\`
- After snapshot ref: \`${preview_after_commit}\`
- Before static build: \`${preview_root_dir}/before\`
- After static build: \`${preview_root_dir}/after\`

Suggested capture flow in a browser-enabled environment:

\`\`\`sh
python3 -m http.server 4301 --directory ${preview_root_dir}/before
python3 -m http.server 4302 --directory ${preview_root_dir}/after
\`\`\`

Then capture:

1. \`http://127.0.0.1:4301/\` for the before screenshot showing the earlier UI state.
2. \`http://127.0.0.1:4302/\` for the after screenshot showing the redesigned calculator.
3. \`http://127.0.0.1:4302/\` again for the short interaction recording using the demo script in \`${summary_path}\`.
EOF
}

package_preview_snapshots() {
  tar -cf "$preview_archive_path" -C "$preview_root_dir" before after
}

write_resume_script() {
  cat >"$resume_script_path" <<EOF
#!/usr/bin/env bash
set -euo pipefail

if [[ \$# -ne 1 ]]; then
  echo "Usage: \$(basename "\$0") <target-repo-dir>" >&2
  exit 1
fi

script_dir="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
target_repo="\$1"
manifest_path="\$script_dir/${manifest_name}"

if [[ ! -d "\$target_repo/.git" ]]; then
  echo "Target repo is not a git checkout: \$target_repo" >&2
  exit 1
fi

node "\$script_dir/verify-handoff.mjs" "\$manifest_path" >/dev/null

mapfile -t handoff_artifacts < <(
  node - "\$manifest_path" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(process.argv[2]);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const bundle = manifest.artifacts?.find((artifact) => artifact.name === "bundle");
const captureNote = manifest.artifacts?.find(
  (artifact) => artifact.name === "preview_capture_note"
);

if (!bundle) {
  console.error("Manifest is missing a bundle artifact: " + manifestPath);
  process.exit(1);
}

console.log(path.resolve(manifestDir, bundle.path));
console.log(captureNote ? path.resolve(manifestDir, captureNote.path) : "");
NODE
)

bundle_path="\${handoff_artifacts[0]}"
capture_note_path="\${handoff_artifacts[1]:-}"
branch="\$(
  git bundle list-heads "\$bundle_path" |
    awk '\$2 ~ /^refs\\/heads\\// {sub("refs/heads/", "", \$2); print \$2; exit}'
)"

if [[ -z "\$branch" ]]; then
  echo "Could not determine a branch ref from bundle: \$bundle_path" >&2
  exit 1
fi

git -C "\$target_repo" fetch "\$bundle_path" "\$branch:\$branch"
git -C "\$target_repo" switch "\$branch" >/dev/null

printf 'Verified manifest: %s\n' "\$manifest_path"
printf 'Imported branch: %s\n' "\$branch"
printf 'Target repo: %s\n' "\$target_repo"
printf 'Head: %s\n' "\$(git -C "\$target_repo" rev-parse "\$branch")"
printf 'Checked out: %s\n' "\$(git -C "\$target_repo" branch --show-current)"

if [[ -n "\$capture_note_path" ]]; then
  printf 'Preview capture: %s\n' "\$capture_note_path"
fi
EOF

  chmod +x "$resume_script_path"
}

if [[ -n "$preview_after_ref" && -z "$preview_before_ref" ]]; then
  echo "HANDOFF_PREVIEW_AFTER_REF requires HANDOFF_PREVIEW_BEFORE_REF." >&2
  exit 1
fi

if [[ -n "$preview_before_ref" ]]; then
  preview_after_ref="${preview_after_ref:-HEAD}"
  preview_before_commit="$(resolve_commit_ref "$preview_before_ref")"
  preview_after_commit="$(resolve_commit_ref "$preview_after_ref")"
fi

for existing_bundle in "$output_dir"/"${repo_slug}"-*.bundle; do
  if [[ -e "$existing_bundle" && "$existing_bundle" != "$bundle_path" ]]; then
    rm -f "$existing_bundle"
  fi
done

./scripts/export_bundle.sh "$bundle_path" >/dev/null
cp docs/pull-request-draft.md "$pr_draft_path"
npm run pr:dry-run >"$dry_run_path"
git log --oneline -n 20 >"$commits_path"
cp scripts/verify-handoff.mjs "$bundled_verifier_path"
write_resume_script

rm -rf "$preview_root_dir" "$capture_note_path" "$preview_archive_path"

if [[ -n "$preview_before_commit" ]]; then
  build_preview_snapshot "$preview_before_commit" "$preview_root_dir/before"
  build_preview_snapshot "$preview_after_commit" "$preview_root_dir/after"
  write_capture_note
  package_preview_snapshots
fi

preview_notes="$(extract_markdown_section "Preview notes" docs/pull-request-draft.md)"
demo_script="$(extract_markdown_section "Demo script" docs/pull-request-draft.md)"

bundle_sha="$(sha256_file "$bundle_path")"
bundle_size="$(file_size "$bundle_path")"
pr_draft_sha="$(sha256_file "$pr_draft_path")"
pr_draft_size="$(file_size "$pr_draft_path")"
dry_run_sha="$(sha256_file "$dry_run_path")"
dry_run_size="$(file_size "$dry_run_path")"
commits_sha="$(sha256_file "$commits_path")"
commits_size="$(file_size "$commits_path")"
bundled_verifier_sha="$(sha256_file "$bundled_verifier_path")"
bundled_verifier_size="$(file_size "$bundled_verifier_path")"
resume_script_sha="$(sha256_file "$resume_script_path")"
resume_script_size="$(file_size "$resume_script_path")"

optional_artifact_lines=$'- `verify-handoff.mjs`\n- `resume-from-handoff.sh`'
optional_manifest_artifact="$(cat <<EOF
    ,
    {
      "name": "bundled_verify_handoff",
      "path": "verify-handoff.mjs",
      "sha256": "${bundled_verifier_sha}",
      "size": ${bundled_verifier_size}
    },
    {
      "name": "resume_from_handoff",
      "path": "resume-from-handoff.sh",
      "sha256": "${resume_script_sha}",
      "size": ${resume_script_size}
    }
EOF
)"

if [[ -f "$capture_note_path" ]]; then
  capture_note_sha="$(sha256_file "$capture_note_path")"
  capture_note_size="$(file_size "$capture_note_path")"
  preview_archive_sha="$(sha256_file "$preview_archive_path")"
  preview_archive_size="$(file_size "$preview_archive_path")"
  optional_artifact_lines="${optional_artifact_lines}"$'\n'"- \`PREVIEW-CAPTURE.md\`"$'\n'"- \`preview-snapshots.tar\`"$'\n'"- \`previews/before/\`"$'\n'"- \`previews/after/\`"
  optional_resume_step=$'7. If `PREVIEW-CAPTURE.md` is present, use its serve commands to capture the\n   required before/after screenshots or short recording in a browser-enabled\n   environment.\n'
  optional_manifest_artifact="${optional_manifest_artifact}$(cat <<EOF
    ,
    {
      "name": "preview_capture_note",
      "path": "PREVIEW-CAPTURE.md",
      "sha256": "${capture_note_sha}",
      "size": ${capture_note_size}
    },
    {
      "name": "preview_snapshots",
      "path": "preview-snapshots.tar",
      "sha256": "${preview_archive_sha}",
      "size": ${preview_archive_size}
    }
EOF
)"
fi

cat >"$summary_path" <<EOF
# ${issue_identifier} Handoff Summary

- Repo: ${repo_slug}
- Repo URL: ${repo_url}
- Branch: ${branch}
- Head: ${head}
- Generated at: ${generated_at}
- Verified bundle: ${bundle_name}
- Bundle SHA-256: ${bundle_sha}

## Preview notes
$(if [[ -n "$preview_notes" ]]; then
    printf '%s\n' "$preview_notes"
  else
    printf '%s\n' '- Preview notes not found in docs/pull-request-draft.md.'
  fi)

## Demo script
$(if [[ -n "$demo_script" ]]; then
    printf '%s\n' "$demo_script"
  else
    printf '%s\n' '- Demo script not found in docs/pull-request-draft.md.'
  fi)

## Resume steps

The paths below use \`<handoff-dir>\` for the directory that contains this
summary, the manifest, and the exported bundle.

1. Clone or choose a writable checkout of the repo at \`<target-repo-dir>\`.
2. From the handoff directory itself, run the bundled resume helper:
   \`./resume-from-handoff.sh <target-repo-dir>\`
3. Or import the bundle into that checkout with plain git:
   \`git -C <target-repo-dir> fetch <handoff-dir>/${bundle_name} ${branch}:${branch}\`
   \`git -C <target-repo-dir> switch ${branch}\`
4. Verify the copied handoff manifest with the bundled verifier:
   \`node <handoff-dir>/verify-handoff.mjs <handoff-dir>/${manifest_name}\`
5. Publish the branch and create or update the PR:
   \`npm run pr:publish\`
6. Attach the resulting PR to \`${issue_identifier}\` and move the issue to
   \`Human Review\`.
$(if [[ -n "$optional_resume_step" ]]; then
    printf '%s' "$optional_resume_step"
  else
    printf '%s\n' '7. In a browser-enabled environment, use the demo script above to capture the'
    printf '%s\n' '   required before/after screenshot or short recording for the PR and Linear'
    printf '%s\n' '   issue.'
  fi)

## Included artifacts

- \`${bundle_name}\`
- \`SUMMARY.md\`
- \`pull-request-draft.md\`
- \`publish-dry-run.txt\`
- \`commits.txt\`
- \`${manifest_name}\`
$(if [[ -n "$optional_artifact_lines" ]]; then
    printf '%s\n' "$optional_artifact_lines"
  fi)
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
    }${optional_manifest_artifact}
  ]
}
EOF

printf 'Handoff directory: %s\n' "$output_dir"
printf 'Bundle: %s\n' "$bundle_path"
printf 'Manifest: %s\n' "$manifest_path"
printf 'Bundle SHA-256: %s\n' "$bundle_sha"
