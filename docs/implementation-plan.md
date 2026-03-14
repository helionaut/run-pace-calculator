# Implementation Plan

## Slice 1 Scope

Deliver the first public working slice with:

- A static single-page calculator UI.
- Shared conversion logic for pace, speed, and finish time.
- Local build, preview, and test scripts.
- GitHub Pages deployment workflow.
- Foundational product and engineering documentation.

## Delivered In This Slice

1. Repository scaffold
   - Added a zero-dependency `package.json`.
   - Added build, dev, preview, and test scripts.
2. Calculator engine
   - Implemented pure conversion helpers for pace, speed, finish time, and
     common distance projections.
   - Added Node tests for representative conversion flows, slider updates, and
     lock-driven recalculation behavior.
3. UI
   - Built a responsive one-screen calculator with a live distance slider,
     preset chips, and visible pace, speed, and finish-time cards.
   - Added clear input, derived, and locked states plus a compact projection
     disclosure for common running distances.
4. Deployment
   - Added a GitHub Pages workflow that builds and deploys `dist/`.
5. Product docs
   - Added and refreshed the PRD, requirements, and this implementation plan to
     match the compact interactive experience.

## Next Slices

1. Add richer race-time entry helpers such as `hh:mm:ss` text parsing and paste
   support.
2. Add permalink sharing so users can send a configured calculator state.
3. Add browser-level smoke-test coverage once the repo standardizes on a
   test framework.
