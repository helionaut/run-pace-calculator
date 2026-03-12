#!/usr/bin/env bash

set -euo pipefail

rm -rf dist
mkdir -p dist
cp index.html styles.css script.js calculator.js dist/
touch dist/.nojekyll
