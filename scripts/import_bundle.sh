#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -ne 2 ]]; then
  echo "Usage: scripts/import_bundle.sh <bundle-path|manifest-path|handoff-dir> <target-repo-dir>" >&2
  exit 1
fi

source_path="$1"
target_repo="$2"
manifest_path=""
capture_note_path=""

source_path="$(cd "$(dirname "$source_path")" && pwd)/$(basename "$source_path")"

if [[ ! -d "$target_repo/.git" ]]; then
  echo "Target repo is not a git checkout: $target_repo" >&2
  exit 1
fi

resolve_manifest_artifacts() {
  node - "$1" <<'EOF'
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.resolve(process.argv[2]);
const manifestDir = path.dirname(manifestPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const bundle = manifest.artifacts?.find((artifact) => artifact.name === "bundle");

if (!bundle) {
  console.error(`Manifest is missing a bundle artifact: ${manifestPath}`);
  process.exit(1);
}

const captureNote = manifest.artifacts?.find(
  (artifact) => artifact.name === "preview_capture_note"
);

console.log(path.resolve(manifestDir, bundle.path));
console.log(captureNote ? path.resolve(manifestDir, captureNote.path) : "");
EOF
}

if [[ -d "$source_path" ]]; then
  shopt -s nullglob
  manifest_matches=("$source_path"/*-handoff-manifest.json)
  shopt -u nullglob

  if [[ ${#manifest_matches[@]} -eq 1 ]]; then
    manifest_path="${manifest_matches[0]}"
  else
    echo "Could not determine a single handoff manifest in: $source_path" >&2
    exit 1
  fi
elif [[ -f "$source_path" && "$source_path" == *.json ]]; then
  manifest_path="$source_path"
elif [[ -f "$source_path" ]]; then
  bundle_path="$source_path"
else
  echo "Bundle, manifest, or handoff directory not found: $source_path" >&2
  exit 1
fi

if [[ -n "$manifest_path" ]]; then
  node "$repo_root/scripts/verify-handoff.mjs" "$manifest_path" >/dev/null
  mapfile -t manifest_artifacts < <(resolve_manifest_artifacts "$manifest_path")
  bundle_path="${manifest_artifacts[0]}"
  capture_note_path="${manifest_artifacts[1]:-}"
fi

if [[ ! -f "$bundle_path" ]]; then
  echo "Bundle not found: $bundle_path" >&2
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

if [[ -n "$manifest_path" ]]; then
  printf 'Verified manifest: %s\n' "$manifest_path"
fi

printf 'Imported branch: %s\n' "$branch"
printf 'Target repo: %s\n' "$target_repo"
printf 'Head: %s\n' "$(git -C "$target_repo" rev-parse "$branch")"

if [[ -n "$capture_note_path" ]]; then
  printf 'Preview capture: %s\n' "$capture_note_path"
fi
