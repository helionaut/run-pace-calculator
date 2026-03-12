#!/usr/bin/env bash

set -euo pipefail

page_url="${1:-}"

if [ -z "$page_url" ]; then
  echo "Usage: $0 <page-url>" >&2
  exit 1
fi

html=""

for attempt in 1 2 3 4 5; do
  html="$(curl --fail --silent --show-error --location "$page_url")" && break
  sleep 5
done

if [ -z "$html" ]; then
  echo "Failed to fetch deployed page at $page_url" >&2
  exit 1
fi

printf '%s' "$html" | grep -q "Run pace, speed, and finish time in one view."
printf '%s' "$html" | grep -q "Run Pace Calculator"
