# Arena3Dweb — Frontend UI/UX Redesign (taste-skill)

**Design read:** Redesign-*preserve* of a scientific 3D-network visualization
tool for bioinformatics researchers. Dark "instrument" canvas app built on
Bootstrap 5 + Vite/TypeScript/Three.js. Direction: cohesive dark instrument
panel, single cool-blue accent, restrained motion, strong hierarchy — without
touching any backend contract, route, data flow, or feature.

Approach followed the token-saviour + ponytail path: **kept Bootstrap** and
*retinted its dark tokens* instead of ripping the framework out or rewriting to
React. Most changes are CSS + small, surgical markup edits. One feature per
commit, no push.

---

## Summary of improvements

1. **Unified design foundation.** Retinted Bootstrap's dark theme to one cool
   palette + accent so every `.btn` / `.form-control` / `.nav` / `.table`
   inherits the system. Refined navbar (frosted, active-tab pill), buttons
   (accent fill, tactile `:active` press), inputs (focus ring), `:focus-visible`
   rings, and a global `prefers-reduced-motion` guard.

2. **Side-drawer panels (key UX fix).** Action panels used to overlay the whole
   3D scene. They now slide in as a right-side drawer (`min(440px, 94vw)`, wider
   for the data table) so the scene stays visible and interactive while you
   operate on it. **Only Home and Help remain full-width**, per the explicit
   constraint. Drawer has a slide-in animation (reduced-motion aware).

3. **Panel content fits the drawer.** Neutralized the now-pointless responsive
   column wrappers inside drawers, and rebuilt the cramped per-layer checkbox
   group into tidy bordered rows with a truncating layer name and aligned
   Hide / Labels toggles.

4. **Home panel redesign.** Hero header with tagline, a figure + readable-measure
   intro grid, two quick-start action cards (Upload / Examples), and a
   de-emphasized citation block. Collapses to one column on mobile.

5. **Help panel themed.** Replaced the light-on-dark tab strip with accent pill
   tabs; restyled headings, code blocks, images, and links for the dark chrome
   and a comfortable reading measure.

6. **Scene overlays + empty state.** The bare "waiting for network" line is now a
   centered empty-state card. Restyled the navigation-controls headings and
   dividers, gave the Recenter button an accent treatment, and replaced the
   raw-red node-description close button with a themed control.

7. **Responsive behavior.** The mobile navbar menu now auto-collapses after a tab
   is picked (so the chosen panel isn't left buried under an open menu), and
   drawers pad their bottom to clear the fixed footer. Verified at desktop
   (1440), tablet (820), and mobile (390).

## Files changed

| File | Change |
|------|--------|
| `frontend/src/style.css` | Design tokens, Bootstrap retint, component polish, drawer system, layer rows, Home/Help/overlay/empty-state styling |
| `frontend/index.html` | Friendlier empty-state copy |
| `frontend/src/ui/home.ts` | Home panel markup restructured (IDs preserved) |
| `frontend/src/ui/layouts.ts` | Per-layer selection rebuilt as clean rows (JS wiring unchanged) |
| `frontend/src/event_listeners.ts` | Auto-collapse mobile navbar on tab select |

No backend files, API endpoints, request/response shapes, routes, or auth logic
were touched.

## Validation commands run

- `npx tsc --noEmit` — clean (after each change)
- `npm run lint` (eslint) — clean
- `npx vitest run` — **106 passed (15 files)**
- `npx playwright test` — **1 passed** (existing `network-flow` E2E)

## Playwright flows tested (baseline + post-change screenshots)

- Home → File → **Load Example** → Main View (scene renders)
- Layer Selection: **Select All Layers → choose Circle layout → Run** ("Layout
  applied", scene re-renders)
- Every panel visited (Scene / Layer / Node / Edge / View Data / FPS / Help)
- Empty state (no network) and loaded-controls state
- Mobile (390) + tablet (820): navbar collapse, drawer, home stack
- **Console errors: 0** across the full sweep

## Known limitations / follow-ups

- On phones the drawer is ~94vw, so it necessarily covers most of the scene —
  unavoidable at that width; the desktop/tablet constraint (don't cover the
  scene) is fully met.
- Node/edge attribute *content* (help tables, node description body) was themed
  but not re-laid-out; a future pass could card-ify the longer help spec tables.
- The nav-control image sprites (rotation arrows, expand/collapse) are the
  original PNGs — left as-is to avoid asset churn; could become inline SVG later
  for crispness on HiDPI.
- No new fonts were added (system-ui stack kept) to avoid a dependency/asset add.
