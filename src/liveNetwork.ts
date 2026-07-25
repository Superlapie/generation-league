import type { ClientMessage } from './network';
import { GenerationNetworkClient, worldSocketUrl } from './network';
import { gameStore } from './state';

export const liveNetwork = new GenerationNetworkClient();

type HelloPayload = Extract<ClientMessage, { type: 'hello' }>['payload'];

let lastHello: HelloPayload | null = null;

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem('generation-league:auth:v1') ?? '{}') as { token?: string; accountId?: string; displayName?: string };
  } catch {
    return {};
  }
}

export function readStoredAuth() {
  return readAuth();
}

export function isLoggedIn() {
  return Boolean(readStoredAuth().token);
}

export function readStoredWorldId() {
  return localStorage.getItem('generation-league:world:v1') || 'mossmere';
}

export function buildHelloPayload(mapId: string, x: number, y: number, worldId = readStoredWorldId()): HelloPayload {
  const auth = readAuth();
  const token = auth.token ?? '';
  return {
    displayName: gameStore.save?.player.name ?? auth.displayName ?? 'Guest',
    guest: !token,
    worldId,
    token: token || undefined,
    mapId,
    x,
    y,
  };
}

function sessionMatches(current: HelloPayload, next: HelloPayload) {
  return current.worldId === next.worldId
    && current.token === next.token
    && current.guest === next.guest
    && current.displayName === next.displayName;
}

export function connectLiveWorldSession(
  mapId: string,
  x: number,
  y: number,
  options: { force?: boolean; pingIntervalMs?: number; worldId?: string } = {},
) {
  const hello = buildHelloPayload(mapId, x, y, options.worldId);
  if (!options.force && liveNetwork.isConnected() && lastHello && sessionMatches(lastHello, hello)) {
    return false;
  }
  liveNetwork.connect(worldSocketUrl(), hello, { pingIntervalMs: options.pingIntervalMs ?? 0 });
  lastHello = hello;
  return true;
}

export function switchWorldSession(worldId: string, mapId: string, x: number, y: number, pingIntervalMs = 15_000) {
  localStorage.setItem('generation-league:world:v1', worldId);
  const hello = buildHelloPayload(mapId, x, y, worldId);
  liveNetwork.connect(worldSocketUrl(), hello, { pingIntervalMs });
  lastHello = hello;
}

export function disconnectLiveWorld() {
  liveNetwork.close();
  lastHello = null;
}
