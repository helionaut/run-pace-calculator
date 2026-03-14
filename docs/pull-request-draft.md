<!-- PR_TITLE: Move distance controls into the header and rebalance split rows -->

## Summary

- replace the distance increment controls with `-100m`, `-200m`, `+100m`, and
  `+200m`, and keep them inline with the Distance heading/value instead of
  taking a separate row
- add left padding to the Distance, Movement Rate, and Time headings so the
  card titles align cleanly away from the screen edge
- rebalance the split summary row so the distance, pace, and time metrics read
  as a more even single line while keeping the action buttons compact
- cover the updated increment behavior and layout hooks with calculator, DOM,
  and CSS regression tests

## Testing

- [x] `npm run check`
- [x] Built-preview desktop/mobile verification via temporary Playwright
  Chromium screenshots against `dist`
- [x] Reviewed a desktop split screenshot and an iPhone 13 mobile split
  screenshot against the issue requirements and `docs/prd.md`

## Risks

- Low: the header-row control fit depends on the compact chip sizing, so future
  copy or typography changes should get another narrow-mobile screenshot pass
- Low: split-row balance is tuned visually with centered metric cells rather
  than content-aware measurement, so unusually long custom values still rely on
  ellipsis as a fallback

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop built-preview screenshot reviewed with a sample split row visible:
  the increment chips stayed in the Distance header row, headings had visible
  left padding, and the split metrics read as a balanced single line.
- iPhone 13 built-preview screenshot reviewed with the same sample split row:
  the inline increment chips remained compact, headings stayed indented, and
  the split row still read as one balanced line above the action icons.
