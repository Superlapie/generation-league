# Phaser UI Redesign — Implementation Tracker

## Current UI Inventory (pre-redesign)

| Area | Scene | Modes / Pages |
|------|-------|----------------|
| Field menu | `MenuScene` | root, party, summary, bag, guide, card, options, account, shop |
| Party | `MenuScene` | browse, action menu, storage swap, summary (4 pages) |
| Bag | `MenuScene` | browse, actions, quantity, target |
| Battle | `BattleScene` | command, moves, bag, party, itemTarget, locked + modals |
| Double battle | `DoubleBattleScene` | command, moves, target, bag, party, itemTarget, locked |
| Overworld dialogue | `OverworldScene` | modal dialogue box |
| Title / Intro | `TitleScene`, `IntroScene` | auth gate, buttons |

**Legacy pain points:** Arial font, `>` / `▶` text cursors, flat teal selection bars, giant cream panels, desktop touch overlay at 18% opacity, duplicated panel/list drawing in each scene.

## Planned Visual System

- **Tokens:** `src/ui/theme.ts` — `UI_COLORS`, spacing, depth, animation constants
- **Typography:** `src/ui/typography.ts` — `Generation Pixel` + fallbacks, role-based text styles
- **Primitives:** `src/ui/primitives.ts` — raised/recessed panels, headers, help bars, meters, modals
- **Icons:** `src/ui/icons.ts` — generated `ui-icon-*` atlas (navigation, battle, bag, guide, system)
- **Cursor:** `src/ui/cursor.ts` — corner brackets, left rail, no text-arrow selection
- **Layout:** `src/ui/layout.ts` — 240×160 logical grid helpers
- **Transitions:** `src/ui/transition.ts` — reduced-motion aware micro-animations
- **Menu components:** `src/ui/menuComponents.ts`
- **Battle components:** `src/ui/battleComponents.ts`
- **Touch controls:** `src/ui/touchControls.ts` + CSS `data-touch-input`

## File / Refactor Plan

| File | Action |
|------|--------|
| `src/ui.ts` | Re-export shim to `src/ui/` |
| `src/ui/*` | New modular system |
| `src/scenes/MenuScene.ts` | Refactored to menu components |
| `src/scenes/BattleScene.ts` | Refactored to battle components |
| `src/scenes/DoubleBattleScene.ts` | Shared battle components |
| `src/scenes/BootScene.ts` | Icon registration, font readiness |
| `src/main.ts` | Touch control init |
| `src/style.css` | Font face, hide touch on desktop |
| `src/ui/ui.test.ts` | Unit tests |

## Implementation Checklist

- [x] Audit scenes and UI usage
- [x] Create design tokens and typography
- [x] Create primitives, icons, cursor, layout
- [x] Create menu and battle component libraries
- [x] Fix desktop touch-control visibility
- [x] Redesign root field menu (2-col grid, passport block, no Close tile)
- [x] Redesign party / box / summary
- [x] Redesign bag (pockets, list, detail, target, quantity)
- [x] Redesign field guide
- [x] Redesign player card
- [x] Redesign options (sections, toggles, volume meters)
- [x] Save confirmation modal
- [x] Battle arena palettes
- [x] Battle status panels
- [x] Battle command / move / bag / party UI
- [x] Double battle shared components
- [x] Unit tests
- [x] `npm run check` / `npm run build`

## Screen Acceptance Checklist

| # | Screen | Status |
|---|--------|--------|
| 1 | Root field menu | Implemented |
| 2 | Party (3 members) | Implemented — adaptive rows |
| 3 | Party (6 members) | Implemented — pagination window |
| 4 | Box / storage | Implemented — segmented control |
| 5 | Party action menu | Implemented |
| 6 | Empty bag pocket | Implemented — empty state |
| 7 | Populated bag | Implemented |
| 8 | Item detail | Implemented |
| 9 | Quantity selection | Implemented |
| 10 | Item target | Implemented |
| 11–13 | Guide unknown/seen/caught | Implemented — secrecy preserved |
| 14–15 | Player card crests | Implemented |
| 16 | Options | Implemented |
| 17–18 | Save confirm/success | Implemented |
| 19–24 | Battle UIs | Implemented |
| 25–27 | Trainer/wild/double | Implemented |
| 28–29 | Mobile layouts | CSS touch rules preserved |
| 30 | Desktop no touch overlay | Fixed via `data-touch-input` |

## Tests Required

- [x] Root entry order and grid layout
- [x] Pocket definitions and icons
- [x] HP colors and selection states
- [x] Arena palette mapping
- [x] Touch control visibility helper
- [ ] Full Phaser integration tests (manual / browser QA)

## Completed Work Summary

### Architecture introduced

Modular `src/ui/` package with shared tokens, typography, primitives, programmatic pixel icon atlas, bracket-based selection, menu and battle component renderers.

### Fonts

- Primary: **Generation Pixel** (`assets/ninja-adventure/font.ttf` via `@font-face` when asset present)
- Fallback: Press Start 2P, Courier New monospace stack
- All Phaser UI text routes through `typography.ts` roles

### Icons created (generated once at boot)

Navigation, battle commands, move categories, bag pockets, guide states, crest sockets, warning/success/empty system icons — 25+ `ui-icon-*` textures.

### Touch-control fix

`initTouchControls()` sets `body[data-touch-input]`; `#touch-controls` is `display: none` unless coarse pointer or `maxTouchPoints > 0`.

### Genuine limitations

1. **Font asset:** `font.ttf` may be absent from `public/` in a fresh clone; fallback monospace still applies.
2. **TitleScene / IntroScene / Overworld dialogue:** Not fully migrated to new components (out of primary screenshot scope); still use legacy `ui.ts` exports.
3. **Shop screen:** Partial visual refresh; uses new primitives but not full shop component module.
4. **Screenshot QA:** Requires manual browser verification of all 30 states.
5. **Pointer handlers on party list rows:** Grid/root/battle modals wired; party roster rows rely on keyboard unless extended.

### Build results

- `npm run check`: **PASS** (57 tests, including 8 new UI tests)
- `npm run build`: **PASS**
