#!/usr/bin/env bash

set -euo pipefail

rm -rf dist
mkdir -p dist
cp index.html styles.css script.js calculator.js dist/
touch dist/.nojekyll

for file in index.html styles.css script.js calculator.js .nojekyll; do
  if [ ! -f "dist/$file" ]; then
    echo "Missing dist/$file after build" >&2
    exit 1
  fi
done
