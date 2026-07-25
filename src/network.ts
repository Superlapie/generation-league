import type {
  ChatMessage, FriendRecord, NetworkEnvelope, PlayerCard, PresenceRecord, TradeListing, TradeSession, WorldDirectoryEntry,
} from './types';

export const NETWORK_VERSION = 1 as const;

export function worldSocketUrl() {
  const configured = import.meta.env.VITE_WORLD_SERVER_URL?.trim();
  if (configured) return configured;
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname || '127.0.0.1'}:8787/socket`;
}

export type ClientMessage =
  | { type: 'ping'; payload: Record<string, never> }
  | { type: 'hello'; payload: { displayName: string; guest: boolean; worldId: string; token?: string; mapId?: string; x?: number; y?: number } }
  | { type: 'auth:register'; payload: { username: string; password: string } }
  | { type: 'auth:login'; payload: { username: string; password: string } }
  | { type: 'profile:get'; payload: Record<string, never> }
  | { type: 'profile:save'; payload: { profile: unknown } }
  | { type: 'presence:update'; payload: Pick<PresenceRecord, 'mapId' | 'x' | 'y'> }
  | { type: 'chat:send'; payload: Pick<ChatMessage, 'channel' | 'body' | 'to'> }
  | { type: 'friend:request'; payload: { accountId: string } }
  | { type: 'friend:respond'; payload: { accountId: string; accept: boolean } }
  | { type: 'player:inspect'; payload: { accountId: string } }
  | { type: 'trade:create'; payload: Omit<TradeListing, 'id' | 'ownerId' | 'createdAt' | 'status'> }
  | { type: 'trade:cancel'; payload: { listingId: string } }
  | { type: 'trade:accept'; payload: { listingId: string; creatureUid: string } };

export type ServerMessage =
  | { type: 'pong'; payload: Record<string, never> }
  | { type: 'hello:ack'; payload: { accountId: string; worldId: string } }
  | { type: 'auth:ack'; payload: { accountId: string; token: string; guest: boolean; displayName: string } }
  | { type: 'profile:ack'; payload: { profile: unknown } }
  | { type: 'worlds:list'; payload: { worlds: WorldDirectoryEntry[] } }
  | { type: 'presence:list'; payload: { players: PresenceRecord[] } }
  | { type: 'presence:changed'; payload: { player: PresenceRecord; online: boolean } }
  | { type: 'chat:message'; payload: ChatMessage }
  | { type: 'friend:changed'; payload: FriendRecord }
  | { type: 'player:card'; payload: PlayerCard }
  | { type: 'trade:changed'; payload: { listing?: TradeListing; session?: TradeSession } }
  | { type: 'error'; payload: { code: string; message: string } };

export function envelope<T>(type: string, payload: T): NetworkEnvelope<T> {
  return { version: NETWORK_VERSION, id: crypto.randomUUID(), type, sentAt: Date.now(), payload };
}

export function isEnvelope(value: unknown): value is NetworkEnvelope {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<NetworkEnvelope>;
  return candidate.version === NETWORK_VERSION && typeof candidate.id === 'string' && typeof candidate.type === 'string' && typeof candidate.sentAt === 'number' && 'payload' in candidate;
}

export function cleanChatBody(body: string) {
  return body.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/[\r\n\t ]+/g, ' ').trim().slice(0, 240);
}

export class GenerationNetworkClient {
  private socket: WebSocket | null = null;
  private pingTimer: number | null = null;
  private pingStartedAt = 0;
  private listeners = new Set<(message: ServerMessage) => void>();
  private closeListeners = new Set<() => void>();
  private suppressCloseEvent = false;
  latencyMs: number | null = null;

  connect(url: string, hello: Extract<ClientMessage, { type: 'hello' }>['payload'], options: { pingIntervalMs?: number } = {}) {
    const pingIntervalMs = options.pingIntervalMs ?? 15_000;
    this.close();
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.send('hello', hello);
      if (pingIntervalMs > 0) this.pingTimer = window.setInterval(() => {
        this.pingStartedAt = performance.now();
        this.send('ping', {});
      }, pingIntervalMs);
    });
    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(String(event.data)) as NetworkEnvelope<ServerMessage['payload']> & { type: ServerMessage['type'] };
        if (!isEnvelope(message)) return;
        if (message.type === 'pong' && this.pingStartedAt) this.latencyMs = Math.round(performance.now() - this.pingStartedAt);
        this.listeners.forEach((listener) => listener(message as ServerMessage));
      } catch { /* Ignore malformed server frames. */ }
    });
    socket.addEventListener('close', () => {
      if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.socket = null;
      if (!this.suppressCloseEvent) this.closeListeners.forEach((listener) => listener());
      this.suppressCloseEvent = false;
    });
  }

  onMessage(listener: (message: ServerMessage) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  onClose(listener: () => void) { this.closeListeners.add(listener); return () => this.closeListeners.delete(listener); }

  isConnected() { return this.socket?.readyState === WebSocket.OPEN; }

  send<T extends ClientMessage['type']>(type: T, payload: Extract<ClientMessage, { type: T }>['payload']) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify(envelope(type, payload)));
    return true;
  }

  close() {
    if (this.pingTimer !== null) window.clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.suppressCloseEvent = true;
    this.socket?.close();
    this.socket = null;
    this.suppressCloseEvent = false;
  }
}
