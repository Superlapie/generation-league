import type { MoveDefinition } from './types';

export interface MovePresentation { projectile: boolean; projectileWidth: number; projectileHeight: number; cameraShake: number; impactTint: number }

const DEFAULT: MovePresentation = { projectile: false, projectileWidth: 8, projectileHeight: 8, cameraShake: .006, impactTint: 0xd1b47b };

export const MOVE_PRESENTATIONS: Record<string, MovePresentation> = {
  impact: { ...DEFAULT, projectile: true, impactTint: 0xd1b47b }, slash: { ...DEFAULT, projectile: true, projectileWidth: 26, projectileHeight: 2, impactTint: 0xe7e5ad },
  guard: DEFAULT, aura: DEFAULT, dust: { ...DEFAULT, projectile: true, impactTint: 0xb89a72 }, leaves: { ...DEFAULT, projectile: true, impactTint: 0x72b64b }, vines: { ...DEFAULT, projectile: true, impactTint: 0x72b64b }, spores: DEFAULT,
  drain: DEFAULT, briars: { ...DEFAULT, projectile: true, impactTint: 0x72b64b }, heal: DEFAULT, crown: { ...DEFAULT, projectile: true, impactTint: 0x72b64b },
  embers: { ...DEFAULT, projectile: true, impactTint: 0xf16b3a }, fireball: { ...DEFAULT, projectile: true, impactTint: 0xf16b3a }, smoke: DEFAULT, flare: { ...DEFAULT, projectile: true, impactTint: 0xf16b3a }, 'cinder-rain': DEFAULT, inferno: { ...DEFAULT, projectile: true, impactTint: 0xf16b3a },
  bubbles: { ...DEFAULT, projectile: true, impactTint: 0x56b9ca }, prism: { ...DEFAULT, projectile: true, impactTint: 0x56b9ca }, barrier: DEFAULT, wave: { ...DEFAULT, projectile: true, impactTint: 0x56b9ca }, rain: DEFAULT, beam: { ...DEFAULT, projectile: true, projectileWidth: 8, projectileHeight: 8, impactTint: 0x56b9ca },
  rocks: { ...DEFAULT, projectile: true, impactTint: 0x9b8564 }, gold: { ...DEFAULT, projectile: true, impactTint: 0xd1b47b }, 'dust-burst': { ...DEFAULT, projectile: true, impactTint: 0xb89a72 }, 'gold-slash': { ...DEFAULT, projectile: true, projectileWidth: 26, projectileHeight: 2, impactTint: 0xd1b47b },
  whip: { ...DEFAULT, projectile: true, impactTint: 0x72b64b }, roll: { ...DEFAULT, projectile: true, impactTint: 0xd1b47b }, wind: { ...DEFAULT, projectile: true, projectileWidth: 26, projectileHeight: 2, impactTint: 0xe7e5ad }, 'bramble-wheel': { ...DEFAULT, projectile: true, impactTint: 0x72b64b },
};

export function movePresentation(move: MoveDefinition) { return MOVE_PRESENTATIONS[move.animation] ?? DEFAULT; }
