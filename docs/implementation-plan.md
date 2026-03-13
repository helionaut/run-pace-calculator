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
   - Added Node tests for representative conversion flows.
3. UI
   - Built a responsive static page with three input modes and live outputs.
   - Added projection and split views for common running distances.
4. Deployment
   - Added a GitHub Pages workflow that builds and deploys `dist/`.
5. Product docs
   - Added PRD, requirements, and this implementation plan.

## Next Slices

1. Add richer race-time entry helpers such as `hh:mm:ss` text parsing and paste
   support.
2. Add mile and kilometer split tables for longer races.
3. Add permalink sharing so users can send a configured calculator state.
4. Add smoke-test coverage in a browser runner once the repo standardizes on a
   test framework.
