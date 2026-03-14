<!-- PR_TITLE: Compact split rows and swap in icon actions -->

## Summary

- shorten split-row pace and time formatting so the row shows compact values
  like `12:34/mi`, `1:00:00`, and `45s` instead of padded verbose strings
- replace the row-level `Copy` and `Delete` text buttons with compact SVG
  duplicate/trash icon buttons that keep accessible labels
- tighten the split-row layout and add regression coverage so the metrics stay
  on one line across desktop and narrow mobile widths

## Testing

- [x] `npm run check`
- [x] Built-preview desktop/mobile verification via a temporary Playwright
  Chromium run against `dist`
- [x] Reviewed split-row screenshots at desktop, `390px`, and `320px` mobile
  widths against the issue requirements

## Risks

- Low: very long custom split values still depend on ellipsis as a last resort,
  so future additions that widen the row will need another responsive check
- Low: the duplicate/trash icons are inline SVG elements, so future style
  changes should keep the icon buttons readable in both default and danger
  states

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop split-builder screenshot reviewed with a long `26.2 mi` row and a
  `45s` row; both rows stayed on one line with the new icon buttons visible.
- Mobile split-builder screenshot reviewed at `390px` width; the compact
  distance, pace, and time labels fit on one line without the action buttons
  forcing wraps.
- Narrow mobile split-builder screenshot reviewed at `320px` width; both rows
  still fit on one line and the icon-only duplicate/delete controls remained
  tappable and visually distinct.
