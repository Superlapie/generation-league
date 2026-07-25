import type {
  ChatMessage, FriendRecord, PlayerCard, PresenceRecord, TradeListing, WorldDirectoryEntry,
} from '../types';
import { canSeePlayer } from '../presence';

export type LeagueLinkSection = 'world' | 'chat' | 'players' | 'trade';
export type ChatChannel = 'local' | 'world' | 'direct';
export type PlayersSubSection = 'nearby' | 'friends' | 'requests';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ObserverPosition {
  mapId: string;
  x: number;
  y: number;
}

export interface OnlineUiState {
  connectionState: ConnectionState;
  accountId: string;
  displayName: string;
  isGuest: boolean;
  selectedWorldId: string;
  connectedWorldId: string;
  pingMs: number | null;
  worlds: WorldDirectoryEntry[];
  worldsLoading: boolean;
  onlinePlayers: Record<string, PresenceRecord>;
  observer: ObserverPosition | null;
  friends: FriendRecord[];
  chatMessages: Record<ChatChannel, ChatMessage[]>;
  activeChatChannel: ChatChannel;
  unreadByChannel: Record<ChatChannel, number>;
  tradeListings: TradeListing[];
  selectedPlayerCard: PlayerCard | null;
  playersSubSection: PlayersSubSection;
  activeSection: LeagueLinkSection;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  pendingActions: string[];
  lastError: string | null;
  lastStatus: string | null;
  chatInputError: string | null;
  chatDirectTarget: string | null;
  worldSwitchPending: boolean;
}

export type OnlineUiPatch = Partial<OnlineUiState>;

const CHAT_CHANNELS: ChatChannel[] = ['local', 'world', 'direct'];

function emptyUnread(): Record<ChatChannel, number> {
  return { local: 0, world: 0, direct: 0 };
}

function emptyChat(): Record<ChatChannel, ChatMessage[]> {
  return { local: [], world: [], direct: [] };
}

export function createInitialOnlineUiState(worldId = 'mossmere'): OnlineUiState {
  return {
    connectionState: 'disconnected',
    accountId: '',
    displayName: 'Guest',
    isGuest: true,
    selectedWorldId: worldId,
    connectedWorldId: worldId,
    pingMs: null,
    worlds: [],
    worldsLoading: false,
    onlinePlayers: {},
    observer: null,
    friends: [],
    chatMessages: emptyChat(),
    activeChatChannel: 'world',
    unreadByChannel: emptyUnread(),
    tradeListings: [],
    selectedPlayerCard: null,
    playersSubSection: 'nearby',
    activeSection: 'world',
    sidebarOpen: true,
    sidebarCollapsed: false,
    mobileDrawerOpen: false,
    pendingActions: [],
    lastError: null,
    lastStatus: null,
    chatInputError: null,
    chatDirectTarget: null,
    worldSwitchPending: false,
  };
}

export class OnlineUiStore {
  private state: OnlineUiState;
  private listeners = new Set<(state: OnlineUiState) => void>();

  constructor(initial?: OnlineUiState) {
    this.state = initial ?? createInitialOnlineUiState();
  }

  getState(): Readonly<OnlineUiState> {
    return this.state;
  }

  subscribe(listener: (state: OnlineUiState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  patch(patch: OnlineUiPatch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  setConnectionState(connectionState: ConnectionState) {
    this.patch({ connectionState });
  }

  setObserver(observer: ObserverPosition | null) {
    this.patch({ observer });
  }

  setWorlds(worlds: WorldDirectoryEntry[]) {
    this.patch({ worlds, worldsLoading: false });
  }

  upsertPresence(player: PresenceRecord) {
    this.patch({ onlinePlayers: { ...this.state.onlinePlayers, [player.accountId]: player } });
  }

  removePresence(accountId: string) {
    if (!this.state.onlinePlayers[accountId]) return;
    const onlinePlayers = { ...this.state.onlinePlayers };
    delete onlinePlayers[accountId];
    this.patch({ onlinePlayers });
  }

  replacePresenceList(players: PresenceRecord[]) {
    const onlinePlayers: Record<string, PresenceRecord> = {};
    players.forEach((player) => { onlinePlayers[player.accountId] = player; });
    this.patch({ onlinePlayers });
  }

  appendChatMessage(message: ChatMessage, viewingChannel: ChatChannel | null) {
    const channel = message.channel as ChatChannel;
    if (!CHAT_CHANNELS.includes(channel)) return false;
    const existing = this.state.chatMessages[channel];
    if (existing.some((entry) => entry.id === message.id)) return false;
    const chatMessages = {
      ...this.state.chatMessages,
      [channel]: [...existing, message].slice(-100),
    };
    const unreadByChannel = { ...this.state.unreadByChannel };
    if (viewingChannel !== channel) unreadByChannel[channel] += 1;
    this.patch({ chatMessages, unreadByChannel });
    return true;
  }

  markChannelRead(channel: ChatChannel) {
    if (this.state.unreadByChannel[channel] === 0) return;
    this.patch({ unreadByChannel: { ...this.state.unreadByChannel, [channel]: 0 } });
  }

  upsertFriend(friend: FriendRecord) {
    const friends = [...this.state.friends.filter((entry) => entry.accountId !== friend.accountId), friend];
    this.patch({ friends });
  }

  upsertTradeListing(listing: TradeListing) {
    const tradeListings = [...this.state.tradeListings.filter((entry) => entry.id !== listing.id), listing]
      .filter((entry) => entry.status === 'open' || entry.status === 'locked');
    this.patch({ tradeListings });
  }

  addPendingAction(action: string) {
    if (this.state.pendingActions.includes(action)) return;
    this.patch({ pendingActions: [...this.state.pendingActions, action] });
  }

  removePendingAction(action: string) {
    if (!this.state.pendingActions.includes(action)) return;
    this.patch({ pendingActions: this.state.pendingActions.filter((entry) => entry !== action) });
  }

  hasPendingAction(action: string) {
    return this.state.pendingActions.includes(action);
  }

  totalUnread(): number {
    return this.state.unreadByChannel.local + this.state.unreadByChannel.world + this.state.unreadByChannel.direct;
  }

  pendingFriendRequests(): FriendRecord[] {
    return this.state.friends.filter((friend) => friend.status === 'pending');
  }

  acceptedFriends(): FriendRecord[] {
    return this.state.friends.filter((friend) => friend.status === 'accepted');
  }

  nearbyPlayers(): PresenceRecord[] {
    const { observer, onlinePlayers, accountId } = this.state;
    if (!observer) return [];
    return Object.values(onlinePlayers).filter((player) => {
      if (player.accountId === accountId) return false;
      return canSeePlayer(observer, player);
    });
  }

  myTradeListings(): TradeListing[] {
    return this.state.tradeListings.filter((listing) => listing.ownerId === this.state.accountId);
  }

  openTradeListings(): TradeListing[] {
    return this.state.tradeListings.filter((listing) => listing.status === 'open' && listing.ownerId !== this.state.accountId);
  }
}

export const onlineUiStore = new OnlineUiStore();
