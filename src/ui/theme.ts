/** Central design tokens for Phaser UI — integer coordinates only. */

export const UI_COLORS = {
  ink: 0x182017,
  inkSoft: 0x30433a,
  paper: 0xf1f1d0,
  paperWarm: 0xe8edcf,
  paperCool: 0xdce7ca,
  surfaceDark: 0x14221d,
  surfaceVoid: 0x0d1713,
  surfaceMid: 0x21382e,
  surfaceLight: 0x2c4543,
  surfaceRaised: 0x334d48,
  recessed: 0x1a2e28,
  borderDeep: 0x293828,
  borderMid: 0x59684f,
  borderLight: 0x6d8f82,
  accentLime: 0xb9ca68,
  accentTeal: 0x5b8f94,
  accentGold: 0xd2af42,
  accentGoldSoft: 0xb99a55,
  accentCopper: 0x9a632d,
  success: 0x5ca85c,
  warning: 0xd2a73d,
  danger: 0xb74635,
  disabled: 0x7a8a7a,
  shadow: 0x101610,
  selection: 0x4a7a78,
  selectionRail: 0xd8d968,
  enemyPanel: 0xe4e9cf,
  playerPanel: 0xd8e3ce,
  battleShell: 0x1a2a24,
  battlePaper: 0xc8d4b8,
  dialogue: 0xedf0d4,
  typeNeutral: 0x8b8375,
} as Record<string, number>;

export const UI_HEX: Record<string, string> = {
  ink: '#182017',
  inkSoft: '#30433a',
  paper: '#f1f1d0',
  paperWarm: '#e8edcf',
  muted: '#52665c',
  light: '#dbe5cf',
  white: '#ffffff',
  lime: '#d8d968',
  gold: '#d2af42',
  danger: '#9f4034',
  teal: '#638f91',
  battleText: '#f1f1d0',
};

export const UI_SPACING: Record<string, number> = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pagePad: 6,
  headerH: 22,
  helpBarH: 18,
  rowH: 14,
  rowHlg: 16,
  tabH: 13,
  gap: 3,
};

export const UI_DEPTH: Record<string, number> = {
  backdrop: 1,
  frame: 2,
  content: 5,
  row: 8,
  selection: 10,
  header: 12,
  modal: 25,
  modalContent: 28,
  cursor: 30,
  tooltip: 35,
};

export const UI_ANIM: Record<string, number> = {
  pageOpen: 110,
  tabChange: 80,
  selectionPulse: 140,
  modalPop: 100,
};

/** @deprecated Use UI_COLORS — kept for gradual migration */
export const COLORS = {
  ink: UI_COLORS.ink,
  paper: UI_COLORS.paper,
  cream: UI_COLORS.paperWarm,
  dark: UI_COLORS.borderDeep,
  border: UI_COLORS.borderMid,
  accent: UI_COLORS.accentLime,
  red: UI_COLORS.danger,
  blue: UI_COLORS.accentTeal,
};

export function hpColor(ratio: number): number {
  if (ratio > 0.5) return UI_COLORS.success;
  if (ratio > 0.2) return UI_COLORS.warning;
  return UI_COLORS.danger;
}

export function typeColor(type: string): number {
  const map: Record<string, number> = {
    Neutral: 0x8b8375, Verdant: 0x5d9b52, Ember: 0xc65b3e, Tide: 0x4b8fa6, Wind: 0x8ca7a1,
    Stone: 0x8a7966, Frost: 0x74a9c2, Volt: 0xd5b545, Mystic: 0x8b67ad, Umbral: 0x5d567c,
    Drake: 0x6f79bc, Metal: 0x8997a4, Venom: 0x8b5e91, Terra: 0x9a704f, Bloom: 0x7aa45c,
    Aether: 0x6ca6a2, Prism: 0xc37aa8,
  };
  return map[type] ?? UI_COLORS.typeNeutral;
}
