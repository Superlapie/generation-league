import { describe, expect, it } from 'vitest';
import { OnlineUiStore, createInitialOnlineUiState } from './onlineUiStore';
import type { ChatMessage, PresenceRecord } from '../types';

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: overrides.id ?? crypto.randomUUID(),
  channel: overrides.channel ?? 'world',
  from: overrides.from ?? 'acct-a',
  body: overrides.body ?? 'Hello',
  createdAt: overrides.createdAt ?? Date.now(),
  ...overrides,
});

const player = (overrides: Partial<PresenceRecord> = {}): PresenceRecord => ({
  accountId: 'acct-b',
  displayName: 'Scout',
  worldId: 'mossmere',
  x: 11,
  y: 10,
  mapId: 'mossmere',
  avatar: 'a',
  onlineAt: Date.now(),
  ...overrides,
});

describe('onlineUiStore', () => {
  it('updates world list and clears loading state', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.patch({ worldsLoading: true });
    store.setWorlds([{ id: 'mossmere', name: 'World 1', players: 3, capacity: 2000, pingMs: 20, healthy: true }]);
    expect(store.getState().worlds).toHaveLength(1);
    expect(store.getState().worldsLoading).toBe(false);
  });

  it('deduplicates chat messages by id', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    const first = message({ id: 'msg-1' });
    expect(store.appendChatMessage(first, 'world')).toBe(true);
    expect(store.appendChatMessage(first, 'world')).toBe(false);
    expect(store.getState().chatMessages.world).toHaveLength(1);
  });

  it('tracks unread counts per channel and clears on read', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.appendChatMessage(message({ id: '1', channel: 'world' }), null);
    store.appendChatMessage(message({ id: '2', channel: 'local' }), null);
    expect(store.getState().unreadByChannel.world).toBe(1);
    expect(store.getState().unreadByChannel.local).toBe(1);
    store.markChannelRead('world');
    expect(store.getState().unreadByChannel.world).toBe(0);
    expect(store.totalUnread()).toBe(1);
  });

  it('does not increment unread for the active viewed channel', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.appendChatMessage(message({ id: '1', channel: 'world' }), 'world');
    expect(store.getState().unreadByChannel.world).toBe(0);
  });

  it('tracks sidebar collapse and mobile drawer state', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.patch({ sidebarCollapsed: true, mobileDrawerOpen: true });
    expect(store.getState().sidebarCollapsed).toBe(true);
    expect(store.getState().mobileDrawerOpen).toBe(true);
  });

  it('filters nearby players within visibility radius', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.patch({
      accountId: 'acct-self',
      observer: { mapId: 'mossmere', x: 10, y: 10 },
      onlinePlayers: {
        'acct-nearby': player({ accountId: 'acct-nearby', x: 11, y: 10 }),
        'acct-far': player({ accountId: 'acct-far', x: 40, y: 10 }),
      },
    });
    expect(onlineUiStoreNearby(store)).toEqual(['acct-nearby']);
  });

  it('transitions connection state through patch updates', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.setConnectionState('connecting');
    store.setConnectionState('connected');
    expect(store.getState().connectionState).toBe('connected');
    store.setConnectionState('reconnecting');
    expect(store.getState().connectionState).toBe('reconnecting');
  });

  it('guards duplicate pending actions', () => {
    const store = new OnlineUiStore(createInitialOnlineUiState());
    store.addPendingAction('chat:send');
    store.addPendingAction('chat:send');
    expect(store.getState().pendingActions).toEqual(['chat:send']);
    store.removePendingAction('chat:send');
    expect(store.hasPendingAction('chat:send')).toBe(false);
  });
});

function onlineUiStoreNearby(store: OnlineUiStore) {
  return store.nearbyPlayers().map((entry) => entry.accountId).sort();
}
