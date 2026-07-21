# Generation League

Generation League is an original, offline monster-catching RPG built with Phaser 4, TypeScript, and Vite. It runs at a fixed 240×160 internal resolution with nearest-neighbor scaling and supports keyboard and touch play.

Play the production release: https://generation-league.vercel.app

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Open http://127.0.0.1:4173/.

Production verification:

```powershell
npm.cmd run check
npm.cmd run build
```

## Controls

- Arrow keys or WASD: move / choose
- Enter, Z, or Space: confirm / interact
- X or Escape: back
- Shift: run
- M: pause menu
- Mobile: on-screen D-pad, A, B, and Menu controls

## Campaign

The campaign contains Mossmere Village, Verdant Path, Glimmerwood, Reedwater Crossing, Cinderstep Town, Ashfall Grotto, Ember Ridge, and Tideglass City, plus furnished interiors. Earn the Glimmer, Cinder, and Tide Crests, complete the League Spire, then continue in post-ending free roam with Warden rematches.

Save data is kept locally in the browser. The game maintains one manual save, its previous valid backup, and three rotating recovery autosaves.

Third-party licenses, source records, and checksums are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
