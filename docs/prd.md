# Product Requirements Document

## Product

Run Pace Calculator is a public web app for runners who need quick conversions
between pace, speed, and projected finish time for common race distances.

## Problem

Runners often know one performance input but need the other two:

- A pace target and the finish time it implies for race day.
- A goal finish time and the pace or speed needed to hit it.
- A treadmill speed and the road pace it represents.

Most existing calculators are visually dated, mobile-hostile, or focused on a
single conversion path.

## Goals

- Deliver a polished static site that runs well on mobile and desktop.
- Support pace, speed, and finish-time driven calculations.
- Cover common race distances from one mile through the marathon.
- Keep the stack simple enough for easy GitHub Pages deployment.

## Primary User Stories

- As a runner, I can enter a pace and see equivalent speed and projected finish
  times across common race distances.
- As a runner, I can enter treadmill speed in mph or km/h and immediately see
  the matching pace.
- As a runner, I can enter a goal finish time for a chosen distance and learn
  the pace and speed required to hold it.
- As a visitor, I can understand the calculator without reading instructions.

## Non-Goals For Slice 1

- Saved plans, accounts, or personalization.
- Grade-adjusted pace, elevation, or weather corrections.
- Training plans, advanced race equivalency formulas, or VO2 max estimates.

## Experience Principles

- One-screen clarity: all essential inputs and outputs should stay visible.
- Immediate feedback: results update as inputs change.
- Dual-unit support: metric and imperial views stay available without friction.
- Public deployment: the app must build into plain static assets.

## Success Criteria

- Local development and build scripts work from a fresh clone.
- Users can complete all three conversion paths without ambiguity.
- The repository contains requirements and an implementation plan for follow-on
  slices.
