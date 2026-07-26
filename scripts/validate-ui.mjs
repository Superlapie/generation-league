import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const fail = (message) => { console.error(`UI validation: ${message}`); process.exitCode = 1; };

const scaler = read('src/online/gameScale.ts');
if (!scaler.includes('pickDesktopScale(availableWidth, availableHeight)')) fail('desktop scaler is missing its compact-shell policy');
if (scaler.includes('`scale(${scale})`')) fail('desktop scaler still uses a CSS transform');
const display = read('src/display.ts');
if (!display.includes('configureWorldCamera') || !display.includes('configureUiCamera')) fail('world/UI camera helpers are missing');
const type = read('src/ui/typography.ts');
if (!type.includes('scene.add.text') || !type.includes('"Segoe UI"') || !type.includes('resolution: 4')) fail('clean renderer-native typography is missing');
const css = read('src/style.css');
if (!css.includes('@media (pointer: fine)') || !css.includes('pointer-events: none')) fail('desktop touch controls are not hard-disabled');
const icons = read('src/ui/icons.ts');
if (icons.includes('generateTexture') || !icons.includes('loadUiIcons')) fail('UI icons are not using the authored asset pipeline');
const battleUi = read('src/ui/battleComponents.ts');
if (!battleUi.includes('pageWindow(opts.cursor, opts.items.length, 6)')) fail('battle bag is missing bounded paging');
if (battleUi.includes('if (!fainted) scene.add.rectangle')) fail('battle party still creates an untracked interaction layer');
const menuUi = read('src/ui/menuComponents.ts');
if (!menuUi.includes('setDisplaySize(12, 12)')) fail('bag pocket icons are missing explicit display bounds');
for (const name of ['creatures', 'bag', 'guide', 'card', 'link', 'account', 'save', 'options', 'fight', 'capture', 'warning', 'success']) {
  if (!existsSync(new URL(`public/assets/ui/icons/${name}.png`, root))) fail(`missing authored UI icon: ${name}`);
}
if (!process.exitCode) console.log('UI validation passed: authored icons, bounded battle overlays, clean typography, deliberate scaling, and desktop touch isolation are present.');
