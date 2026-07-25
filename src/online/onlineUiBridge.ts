import { cleanChatBody } from '../network';
import type { ServerMessage } from '../network';
import { liveNetwork } from '../liveNetwork';
import {
  connectLiveWorldSession, markReconnectDelay, readStoredWorldId, switchWorldSession,
} from '../liveNetwork';
import { gameStore } from '../state';
import { applyCloudProfile, toCloudProfile } from '../cloudProfile';
import type { ChatChannel, LeagueLinkSection, ObserverPosition } from './onlineUiStore';
import { onlineUiStore } from './onlineUiStore';
import { pushNotification } from './OnlineNotifications';

const CHAT_LIMIT = 240;
let initialized = false;
let networkOff: (() => void) | undefined;
let networkCloseOff: (() => void) | undefined;
let viewingChatChannel: ChatChannel | null = null;

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem('generation-league:auth:v1') ?? '{}') as {
      token?: string; accountId?: string; displayName?: string;
    };
  } catch {
    return {};
  }
}

function syncConnectionFlags() {
  if (liveNetwork.isConnecting()) onlineUiStore.setConnectionState('connecting');
  else if (liveNetwork.isConnected()) onlineUiStore.setConnectionState('connected');
  else if (onlineUiStore.getState().connectionState === 'reconnecting') return;
  else onlineUiStore.setConnectionState('disconnected');
}

function handleServerMessage(message: ServerMessage) {
  const state = onlineUiStore.getState();
  switch (message.type) {
    case 'hello:ack': {
      const wasReconnecting = state.connectionState === 'reconnecting';
      onlineUiStore.patch({
        accountId: message.payload.accountId,
        connectedWorldId: message.payload.worldId,
        selectedWorldId: message.payload.worldId,
        isGuest: message.payload.accountId.startsWith('guest-'),
        worldSwitchPending: false,
        lastStatus: `Connected to ${message.payload.worldId}`,
      });
      const observer = onlineUiStore.getState().observer;
      if (observer) {
        liveNetwork.send('presence:update', { mapId: observer.mapId, x: observer.x, y: observer.y });
      }
      if (!message.payload.accountId.startsWith('guest-')) liveNetwork.send('profile:get', {});
      if (wasReconnecting) onReconnected();
      else pushNotification({ kind: 'world-changed', title: 'World joined', body: message.payload.worldId });
      break;
    }
    case 'auth:ack': {
      const auth = message.payload;
      localStorage.setItem('generation-league:auth:v1', JSON.stringify({
        accountId: auth.accountId,
        token: auth.token,
        displayName: auth.displayName,
      }));
      onlineUiStore.patch({
        accountId: auth.accountId,
        displayName: auth.displayName,
        isGuest: auth.guest,
        lastStatus: `Signed in as ${auth.displayName}`,
      });
      liveNetwork.send('profile:get', {});
      break;
    }
    case 'profile:ack': {
      const profile = message.payload.profile as { schemaVersion?: number };
      if (profile.schemaVersion === 2 && gameStore.save) {
        try {
          gameStore.save = applyCloudProfile(gameStore.save, message.payload.profile as Parameters<typeof applyCloudProfile>[1]);
          gameStore.manualSave();
          onlineUiStore.patch({ lastStatus: 'Cloud profile restored' });
        } catch {
          onlineUiStore.patch({ lastError: 'Cloud profile failed validation' });
        }
      } else if (gameStore.save && state.accountId && !state.isGuest) {
        uploadCloudProfile();
        onlineUiStore.patch({ lastStatus: 'Local progress uploaded to cloud' });
      }
      break;
    }
    case 'worlds:list':
      onlineUiStore.setWorlds(message.payload.worlds);
      break;
    case 'presence:list':
      onlineUiStore.replacePresenceList(message.payload.players);
      break;
    case 'presence:changed':
      if (message.payload.online) onlineUiStore.upsertPresence(message.payload.player);
      else onlineUiStore.removePresence(message.payload.player.accountId);
      break;
    case 'chat:message': {
      const channel = message.payload.channel as ChatChannel;
      const added = onlineUiStore.appendChatMessage(message.payload, viewingChatChannel);
      if (added && channel === 'direct') {
        pushNotification({
          kind: 'direct-message',
          title: 'Direct message',
          body: message.payload.body,
          section: 'chat',
        });
      }
      break;
    }
    case 'friend:changed': {
      onlineUiStore.upsertFriend(message.payload);
      if (message.payload.status === 'pending') {
        pushNotification({
          kind: 'friend-request',
          title: 'Friend request',
          body: message.payload.displayName,
          section: 'players',
        });
      }
      break;
    }
    case 'player:card':
      onlineUiStore.patch({ selectedPlayerCard: message.payload });
      break;
    case 'trade:changed':
      if (message.payload.listing) {
        onlineUiStore.upsertTradeListing(message.payload.listing);
        if (message.payload.listing.status === 'open' && message.payload.listing.ownerId !== state.accountId) {
          pushNotification({
            kind: 'trade-request',
            title: 'Trade listing',
            body: `${message.payload.listing.offeredSpeciesId} Lv${message.payload.listing.offeredLevel}`,
            section: 'trade',
          });
        }
      }
      onlineUiStore.removePendingAction('trade:create');
      onlineUiStore.removePendingAction('trade:accept');
      onlineUiStore.removePendingAction('trade:cancel');
      break;
    case 'pong':
      onlineUiStore.patch({ pingMs: liveNetwork.latencyMs });
      break;
    case 'error':
      onlineUiStore.patch({ lastError: message.payload.message, chatInputError: message.payload.message });
      pushNotification({ kind: 'error', title: 'Error', body: message.payload.message, durationMs: 8_000 });
      break;
    default:
      break;
  }
  syncConnectionFlags();
}

export function initOnlineUiBridge() {
  if (initialized) return;
  initialized = true;
  const auth = readAuth();
  onlineUiStore.patch({
    selectedWorldId: readStoredWorldId(),
    connectedWorldId: readStoredWorldId(),
    accountId: auth.accountId ?? '',
    displayName: auth.displayName ?? gameStore.save?.player.name ?? 'Guest',
    isGuest: !auth.token,
  });
  networkOff = liveNetwork.onMessage(handleServerMessage);
  networkCloseOff = liveNetwork.onClose(() => {
    onlineUiStore.setConnectionState('reconnecting');
    markReconnectDelay(3_000);
    pushNotification({ kind: 'connection-lost', title: 'Connection lost', body: 'Reconnecting…', durationMs: 6_000 });
  });
  const pingTimer = window.setInterval(() => {
    if (liveNetwork.isConnected()) onlineUiStore.patch({ pingMs: liveNetwork.latencyMs });
    syncConnectionFlags();
  }, 2_000);
  window.addEventListener('beforeunload', () => window.clearInterval(pingTimer));
}

export function setViewingChatChannel(channel: ChatChannel | null) {
  viewingChatChannel = channel;
  if (channel) onlineUiStore.markChannelRead(channel);
}

export function setObserver(observer: ObserverPosition | null) {
  onlineUiStore.setObserver(observer);
}

export function openLeagueLink(section?: LeagueLinkSection) {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  onlineUiStore.patch({
    activeSection: section ?? onlineUiStore.getState().activeSection,
    sidebarOpen: true,
    mobileDrawerOpen: mobile,
    sidebarCollapsed: false,
  });
}

export function closeMobileDrawer() {
  onlineUiStore.patch({ mobileDrawerOpen: false });
}

export function toggleSidebarCollapsed() {
  const { sidebarCollapsed } = onlineUiStore.getState();
  onlineUiStore.patch({ sidebarCollapsed: !sidebarCollapsed });
}

export function setActiveSection(section: LeagueLinkSection) {
  onlineUiStore.patch({ activeSection: section });
  if (section === 'chat') {
    const channel = onlineUiStore.getState().activeChatChannel;
    setViewingChatChannel(channel);
  } else {
    setViewingChatChannel(null);
  }
}

export function setActiveChatChannel(channel: ChatChannel) {
  onlineUiStore.patch({ activeChatChannel: channel, chatInputError: null });
  if (onlineUiStore.getState().activeSection === 'chat') setViewingChatChannel(channel);
  else onlineUiStore.markChannelRead(channel);
}

export function sendChat(body: string, channel?: ChatChannel, directTo?: string) {
  const cleaned = cleanChatBody(body);
  if (!cleaned) return false;
  if (cleaned.length > CHAT_LIMIT) {
    onlineUiStore.patch({ chatInputError: `Message limit is ${CHAT_LIMIT} characters` });
    return false;
  }
  const activeChannel = channel ?? onlineUiStore.getState().activeChatChannel;
  const to = directTo ?? (activeChannel === 'direct' ? onlineUiStore.getState().chatDirectTarget ?? undefined : undefined);
  if (activeChannel === 'direct' && !to) {
    onlineUiStore.patch({ chatInputError: 'Select a player to message first' });
    return false;
  }
  if (onlineUiStore.hasPendingAction('chat:send')) return false;
  onlineUiStore.addPendingAction('chat:send');
  onlineUiStore.patch({ chatInputError: null });
  const sent = liveNetwork.send('chat:send', { channel: activeChannel, body: cleaned, to });
  window.setTimeout(() => onlineUiStore.removePendingAction('chat:send'), 400);
  if (!sent) {
    onlineUiStore.patch({ chatInputError: 'Not connected to the world server' });
    onlineUiStore.removePendingAction('chat:send');
    return false;
  }
  return true;
}

export function switchWorld(worldId: string) {
  const save = gameStore.save;
  if (!save) return false;
  if (onlineUiStore.hasPendingAction('world:switch')) return false;
  onlineUiStore.addPendingAction('world:switch');
  onlineUiStore.patch({ worldSwitchPending: true, selectedWorldId: worldId, lastError: null });
  localStorage.setItem('generation-league:world:v1', worldId);
  const started = switchWorldSession(worldId, save.location.mapId, save.location.x, save.location.y);
  if (!started) {
    onlineUiStore.removePendingAction('world:switch');
    onlineUiStore.patch({ worldSwitchPending: false, lastError: 'Could not switch worlds right now' });
    return false;
  }
  window.setTimeout(() => {
    onlineUiStore.removePendingAction('world:switch');
    onlineUiStore.patch({ worldSwitchPending: false });
  }, 5_000);
  return true;
}

export function ensureWorldConnection() {
  const save = gameStore.save;
  if (!save) return false;
  onlineUiStore.patch({ worldsLoading: true });
  return connectLiveWorldSession(save.location.mapId, save.location.x, save.location.y, { pingIntervalMs: 15_000 });
}

export function inspectPlayer(accountId: string) {
  return liveNetwork.send('player:inspect', { accountId });
}

export function requestFriend(accountId: string) {
  if (onlineUiStore.hasPendingAction(`friend:${accountId}`)) return false;
  onlineUiStore.addPendingAction(`friend:${accountId}`);
  const sent = liveNetwork.send('friend:request', { accountId });
  window.setTimeout(() => onlineUiStore.removePendingAction(`friend:${accountId}`), 2_000);
  return sent;
}

export function respondFriend(accountId: string, accept: boolean) {
  return liveNetwork.send('friend:respond', { accountId, accept });
}

export function createTradeListing(creatureUid: string, speciesId: string, level: number) {
  if (onlineUiStore.hasPendingAction('trade:create')) return false;
  const state = onlineUiStore.getState();
  if (!state.accountId || state.isGuest) {
    onlineUiStore.patch({ lastError: 'Link a cloud account before trading' });
    return false;
  }
  uploadCloudProfile();
  onlineUiStore.addPendingAction('trade:create');
  const sent = liveNetwork.send('trade:create', {
    offeredCreatureUid: creatureUid,
    offeredSpeciesId: speciesId,
    offeredLevel: level,
    expiresAt: Date.now() + 86_400_000,
  });
  if (!sent) onlineUiStore.removePendingAction('trade:create');
  return sent;
}

export function acceptTrade(listingId: string, creatureUid: string) {
  if (onlineUiStore.hasPendingAction('trade:accept')) return false;
  const state = onlineUiStore.getState();
  if (!state.accountId || state.isGuest) {
    onlineUiStore.patch({ lastError: 'Link a cloud account before trading' });
    return false;
  }
  uploadCloudProfile();
  onlineUiStore.addPendingAction('trade:accept');
  const sent = liveNetwork.send('trade:accept', { listingId, creatureUid });
  if (!sent) onlineUiStore.removePendingAction('trade:accept');
  return sent;
}

export function cancelTrade(listingId: string) {
  if (onlineUiStore.hasPendingAction('trade:cancel')) return false;
  onlineUiStore.addPendingAction('trade:cancel');
  const sent = liveNetwork.send('trade:cancel', { listingId });
  if (!sent) onlineUiStore.removePendingAction('trade:cancel');
  return sent;
}

export function clearSelectedPlayerCard() {
  onlineUiStore.patch({ selectedPlayerCard: null });
}

export function uploadCloudProfile() {
  const state = onlineUiStore.getState();
  if (!gameStore.save || !state.accountId || state.isGuest) return false;
  return liveNetwork.send('profile:save', {
    profile: toCloudProfile(gameStore.save, state.accountId, state.connectedWorldId, false),
  });
}

export function submitAuth(mode: 'login' | 'register', username: string, password: string) {
  return liveNetwork.send(mode === 'register' ? 'auth:register' : 'auth:login', { username, password });
}

export function onReconnected() {
  onlineUiStore.setConnectionState('connected');
  pushNotification({ kind: 'reconnected', title: 'Reconnected', body: 'Back online', section: 'world' });
}

export function disposeOnlineUiBridge() {
  networkOff?.();
  networkCloseOff?.();
  networkOff = undefined;
  networkCloseOff = undefined;
  initialized = false;
}
