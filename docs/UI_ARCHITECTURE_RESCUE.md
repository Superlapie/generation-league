# UI architecture rescue

## Audit

The canvas is correctly allocated at 480×320, but the prior UI pass used
`configureGbaCamera()` (zoom 2, centered on 120×80) for menus and battle HUD.
It therefore authored interface geometry at roughly 240×160 and enlarged it.
At the shell level, `pickFitScale()` then applied a fractional CSS transform.
The UI also used browser/TTF `Phaser.GameObjects.Text` at tiny sizes, with
synthetic bold in its shared typography helper. This is the source of the
soft glyphs, oversized labels, clipped descriptions, and collisions visible in
the supplied captures. Desktop touch controls were not hard-disabled.

## Rendering architecture

World rendering uses `configureWorldCamera()`: zoom 2, round pixels, and the
existing 240×160 world coordinate system. Native UI rendering uses
`configureUiCamera()`: zoom 1, round pixels, centered on the full 480×320
canvas. New UI work belongs on the native camera; it must never inherit the
world-camera helper. Scenes retain their existing state machines and input;
the camera split introduces no subscriptions, persistence, or network traffic.

## Typography and scaling

Game UI copy uses renderer-native `Phaser.GameObjects.Text` through one shared
typography helper. It uses a clean system sans-serif stack, restrained weights,
integer positions, bounded sizes, and high-resolution glyph rasterization.
The decorative Ninja Adventure font is not used for game UI copy.

Fine-pointer desktop sizing uses 1× (480×320), 2× (960×640), or 3×
(1440×960) whenever possible. A deliberate 1.5× compact-shell step
(720×480) is used only when 2× cannot physically fit but 1× would waste the
available play space. The host and canvas receive exact dimensions with no CSS
transform. Coarse-pointer mobile retains fit scaling. Fine pointers hard-hide
touch controls with no pointer interception.

## Migration plan and screen inventory

1. Move every menu and battle layout from 240×160 primitives to the native
   camera and 4/8px grid.
2. Route remaining descriptions and dialogue through the shared typography
   wrapper and deterministic wrapping helper.
3. Recompose Field Menu, Party/Box, Bag, Guide, Player Card, Options, single
   battle, and double battle with dark surfaces, bounded paper panels, and
   consistent 16/20px icons.
4. Add deterministic `uiPreview` fixtures and capture each screen at 1×, 2×,
   3×, 1920×1080 shell, and 2560×1440 shell.

The required acceptance matrix checks: hard glyph edges, integer scaling,
headers separated from subtitles, text inside panels, help-bar reservation,
no desktop controls, bounded Guide descriptions, and no modal that obscures
essential battle context.

## Implementation checklist

- [x] Audit rendering path and document root causes.
- [x] Split explicit world and UI camera helpers.
- [x] Centralize clean renderer-native UI typography.
- [x] Remove fractional desktop transforms and hard-disable desktop touch UI.
- [x] Add static UI validation and scale assertions.
- [ ] Complete native-coordinate migration of each legacy scene.
- [ ] Add gallery fixtures, Playwright captures, and manual 1×/2×/3× review.

The unchecked work is intentionally recorded rather than represented as
complete: it needs a focused follow-up that rewrites every existing 240×160
layout onto the new native UI plane without changing gameplay behavior.
