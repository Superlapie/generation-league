import {
  closeMobileDrawer, ensureWorldConnection, initOnlineUiBridge, openLeagueLink, setActiveSection, toggleSidebarCollapsed,
} from './onlineUiBridge';
import type { LeagueLinkSection } from './onlineUiStore';
import { onlineUiStore } from './onlineUiStore';
import { renderChatView } from './views/ChatView';
import { renderPlayersView } from './views/PlayersView';
import { renderTradeView } from './views/TradeView';
import { renderWorldView } from './views/WorldView';
import './online-ui.css';

const NAV: Array<{ id: LeagueLinkSection; label: string; icon: string }> = [
  { id: 'world', label: 'World', icon: iconGlobe() },
  { id: 'chat', label: 'Chat', icon: iconChat() },
  { id: 'players', label: 'Players', icon: iconPlayers() },
  { id: 'trade', label: 'Trade', icon: iconTrade() },
];

let mounted = false;
let viewCleanup: (() => void) | undefined;
let mediaQuery: MediaQueryList | undefined;

function connectionDot(state: string) {
  if (state === 'connected') return 'is-online';
  if (state === 'connecting' || state === 'reconnecting') return 'is-reconnecting';
  return 'is-offline';
}

function navBadge(section: LeagueLinkSection, state: ReturnType<typeof onlineUiStore.getState>) {
  if (section === 'chat') return onlineUiStore.totalUnread();
  if (section === 'players') return onlineUiStore.pendingFriendRequests().length;
  return 0;
}

function mountView(section: LeagueLinkSection, host: HTMLElement) {
  viewCleanup?.();
  switch (section) {
    case 'world': viewCleanup = renderWorldView(host); break;
    case 'chat': viewCleanup = renderChatView(host); break;
    case 'players': viewCleanup = renderPlayersView(host); break;
    case 'trade': viewCleanup = renderTradeView(host); break;
    default: viewCleanup = renderWorldView(host);
  }
}

function renderShell() {
  const state = onlineUiStore.getState();
  const mobile = mediaQuery?.matches ?? false;
  const sidebar = document.getElementById('league-link');
  const headerWorld = document.querySelector('[data-header-world]');
  const headerConnection = document.querySelector('[data-header-connection]');
  const headerLocation = document.querySelector('[data-header-location]');
  const launcher = document.querySelector('[data-ll-launcher]');
  const launcherBadge = document.querySelector('[data-ll-launcher-badge]');
  const footerStatus = document.querySelector('[data-footer-status]');

  document.body.classList.toggle('ll-drawer-open', mobile && state.mobileDrawerOpen);
  document.body.classList.toggle('ll-sidebar-collapsed', !mobile && state.sidebarCollapsed);
  document.body.classList.toggle('ll-sidebar-hidden', !mobile && !state.sidebarOpen);

  if (headerWorld) headerWorld.textContent = state.connectedWorldId;
  if (headerConnection) {
    headerConnection.className = `ll-conn-dot ${connectionDot(state.connectionState)}`;
    headerConnection.setAttribute('aria-label', `Connection ${state.connectionState}`);
  }
  if (headerLocation) {
    const mapId = state.observer?.mapId ?? gameLocationLabel();
    headerLocation.textContent = mapId.replaceAll('-', ' ').toUpperCase();
  }
  if (launcherBadge) {
    const unread = onlineUiStore.totalUnread() + onlineUiStore.pendingFriendRequests().length;
    (launcherBadge as HTMLElement).hidden = unread === 0;
    launcherBadge.textContent = String(unread);
  }
  if (launcher) {
    launcher.className = `ll-launcher ${connectionDot(state.connectionState)}`;
  }
  if (footerStatus) {
    footerStatus.textContent = state.connectionState === 'connected'
      ? `Online · ${state.pingMs === null ? '—' : `${state.pingMs}ms`} · ${onlineUiStore.nearbyPlayers().length} nearby`
      : state.connectionState === 'reconnecting' ? 'Reconnecting…' : 'Offline';
  }

  if (!sidebar) return;
  sidebar.classList.toggle('is-collapsed', !mobile && state.sidebarCollapsed);
  sidebar.classList.toggle('is-drawer', mobile);
  sidebar.classList.toggle('is-open', mobile ? state.mobileDrawerOpen : state.sidebarOpen);
  sidebar.hidden = mobile ? false : !state.sidebarOpen;

  sidebar.innerHTML = `
    <header class="ll-sidebar-head">
      <div class="ll-brand-block">
        <p class="ll-kicker">League Link</p>
        <div class="ll-head-meta">
          <span class="ll-conn-dot ${connectionDot(state.connectionState)}" aria-hidden="true"></span>
          <span class="ll-head-world">${state.connectedWorldId}</span>
          <span class="ll-head-ping">${state.pingMs === null ? '—' : `${state.pingMs}ms`}</span>
        </div>
      </div>
      <button type="button" class="ll-icon-btn" data-ll-collapse aria-label="${state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${state.sidebarCollapsed ? '›' : '‹'}</button>
    </header>
    <nav class="ll-nav" aria-label="League Link sections">
      ${NAV.map((item) => {
        const badge = navBadge(item.id, state);
        return `
          <button type="button" class="ll-nav-btn ${state.activeSection === item.id ? 'is-active' : ''}"
            data-section="${item.id}" aria-current="${state.activeSection === item.id ? 'page' : 'false'}">
            <span class="ll-nav-icon" aria-hidden="true">${item.icon}</span>
            <span class="ll-nav-label">${item.label}</span>
            ${badge ? `<span class="ll-badge">${badge}</span>` : ''}
          </button>`;
      }).join('')}
    </nav>
    <div class="ll-view-host" data-ll-view-host></div>`;

  sidebar.querySelector('[data-ll-collapse]')?.addEventListener('click', () => {
    if (mobile) closeMobileDrawer();
    else toggleSidebarCollapsed();
  });
  sidebar.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      const section = (button as HTMLElement).dataset.section as LeagueLinkSection;
      setActiveSection(section);
    });
  });

  const host = sidebar.querySelector('[data-ll-view-host]') as HTMLElement | null;
  if (host) mountView(state.activeSection, host);
  window.dispatchEvent(new CustomEvent('generation-league:sidebar-layout'));
}

function gameLocationLabel() {
  try {
    const map = document.body.dataset.map;
    return map ?? 'Field';
  } catch {
    return 'Field';
  }
}

function bindGlobalControls() {
  document.querySelector('[data-ll-toggle]')?.addEventListener('click', () => {
    const mobile = mediaQuery?.matches ?? false;
    const state = onlineUiStore.getState();
    if (mobile) onlineUiStore.patch({ mobileDrawerOpen: !state.mobileDrawerOpen, sidebarOpen: true });
    else onlineUiStore.patch({ sidebarOpen: !state.sidebarOpen, sidebarCollapsed: false });
  });
  document.querySelector('[data-ll-launcher]')?.addEventListener('click', () => openLeagueLink());
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const state = onlineUiStore.getState();
    if (state.selectedPlayerCard) {
      onlineUiStore.patch({ selectedPlayerCard: null });
      return;
    }
    if (state.mobileDrawerOpen) closeMobileDrawer();
  });
}

export function initLeagueLink() {
  if (mounted) return;
  mounted = true;
  initOnlineUiBridge();
  mediaQuery = window.matchMedia('(max-width: 900px)');
  mediaQuery.addEventListener('change', renderShell);
  onlineUiStore.subscribe(renderShell);
  bindGlobalControls();
  renderShell();
  ensureWorldConnection();
}

export { openLeagueLink };

function iconGlobe() {
  return '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm5.8 4.5H9.6c-.1-.9-.3-1.7-.6-2.4A5.8 5.8 0 0 1 13.8 5.5ZM8 2.4c.4.7.7 1.6.9 2.6H5.1c.2-1 .5-1.9.9-2.6A5.7 5.7 0 0 1 8 2.4ZM2.2 5.5h4.6a12 12 0 0 0-.6 2.4H1.5a5.8 5.8 0 0 1 .7-2.4ZM1.5 9.5h4.7c.1.8.3 1.6.6 2.4H2.2a5.8 5.8 0 0 1-.7-2.4Zm2.5 3.6h4.6c-.2 1-.5 1.9-.9 2.6a5.7 5.7 0 0 1-3.7-2.6Zm5.9 2.6c-.4-.7-.7-1.6-.9-2.6h3.7c-.8 1.1-1.9 2-3.2 2.6Zm4-2.6H9.1c.2 1 .5 1.9.9 2.6a5.7 5.7 0 0 0 3.1-2.6Zm1.1-3.6H9.6c-.1-.8-.3-1.6-.6-2.4h4.6c.4.7.7 1.5.7 2.4Z"/></svg>';
}

function iconChat() {
  return '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 2h12v8H5.4L2 13.5V2Zm1 1v8.8L5 10h8V3H3Z"/></svg>';
}

function iconPlayers() {
  return '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.2c0-2.2 2-3.7 4.5-3.7s4.5 1.5 4.5 3.7v.8H1.5v-.8Zm9 0c.1-1.5 1.2-2.6 2.8-3-.9-.7-2.1-1.1-3.5-1.1-1 0-1.9.2-2.6.6 1.8.5 3 1.9 3.1 3.5h.2Z"/></svg>';
}

function iconTrade() {
  return '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 5h8.6l-2-2 1.4-1.4L15 6.5l-3 4.9-1.4-1.4 2-2H2V5Zm12 6H5.4l2 2-1.4 1.4L1 9.5l3-4.9 1.4 1.4-2 2H14v3Z"/></svg>';
}
