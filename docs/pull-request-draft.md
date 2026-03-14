<!-- PR_TITLE: Tighten the mobile layout and stabilize preset wrapping -->

## Summary

- tighten padding, gaps, and control sizing across the calculator so the mobile
  layout stays denser without adding extra rows
- remove the duplicate `Time` title treatment, move split status onto the
  workout-splits heading line, and let the top status text wrap cleanly instead
  of truncating
- normalize quick-preset labeling and mobile layout so km/mi switching keeps
  the preset area at the same height

## Testing

- [x] `npm run check`
- [x] Built-preview desktop/mobile verification via a temporary Playwright run
  against `dist`
- [x] Mobile preset row measured at the same height in preview for km and mi
  (`58px`)

## Risks

- Low: the mobile preset row now uses a fixed compact grid, so any future
  addition of more quick presets will need a deliberate responsive layout pass
- Low: the header status now wraps to two lines; longer future status copy may
  need another wording pass if it becomes materially longer

## Checklist

- [x] Scope matches the linked Linear issue
- [x] Docs updated if behavior or workflow changed
- [x] Screenshots or preview notes added when UI changed

Preview notes:

- Desktop built-preview screenshot reviewed with a saved split present; the
  layout stayed compact and the split status remained inline with the heading.
- Mobile built-preview screenshots reviewed in both km and mi modes at 390px
  width; the quick preset area stayed at two rows in both unit systems with no
  extra wrap on unit switch.
- Narrow mobile built-preview screenshot reviewed at 320px width; the top
  status text wrapped cleanly across two lines without clipping, and the
  compact spacing changes still preserved the one-screen layout.
