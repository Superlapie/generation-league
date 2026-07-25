export const ROOT_ENTRIES = [
  { id: 'CREATURES', label: 'Creatures', help: 'Review, switch, store, and equip your team.' },
  { id: 'BAG', label: 'Bag', help: 'Use medicine, Pods, held items, and key gear.' },
  { id: 'FIELD GUIDE', label: 'Field Guide', help: 'Review every creature you have seen or caught.' },
  { id: 'PLAYER CARD', label: 'Player Card', help: 'View your journey record and earned Crests.' },
  { id: 'LEAGUE LINK', label: 'League Link', help: 'World shards, chat, nearby players, friends, and trades.' },
  { id: 'ACCOUNT', label: 'Account', help: 'Link a durable cloud identity and protect your progression.' },
  { id: 'SAVE', label: 'Save', help: 'Write a protected manual save and backup.' },
  { id: 'OPTIONS', label: 'Options', help: 'Tune battle presentation and audio.' },
] as const;

export const POCKET_DEFS = [
  { id: 'recovery' as const, label: 'MED', icon: 'ui-icon-medicine' },
  { id: 'capture' as const, label: 'PODS', icon: 'ui-icon-capture' },
  { id: 'held' as const, label: 'HELD', icon: 'ui-icon-held' },
  { id: 'key' as const, label: 'KEY', icon: 'ui-icon-key' },
];

export type ArenaPalette = 'verdant' | 'ember' | 'tide' | 'cave' | 'trainer';

export function arenaPaletteForMap(mapId: string): ArenaPalette {
  if (mapId.includes('cinder') || mapId.includes('ember') || mapId.includes('ash')) return 'ember';
  if (mapId.includes('tide') || mapId.includes('reed') || mapId.includes('water')) return 'tide';
  if (mapId.includes('cave') || mapId.includes('hall')) return 'cave';
  if (mapId.includes('warden') || mapId.includes('gym')) return 'trainer';
  return 'verdant';
}
