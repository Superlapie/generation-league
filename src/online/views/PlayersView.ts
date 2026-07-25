import {
  clearSelectedPlayerCard, inspectPlayer, requestFriend, respondFriend, sendChat, setActiveSection,
} from '../onlineUiBridge';
import type { PlayersSubSection } from '../onlineUiStore';
import { onlineUiStore } from '../onlineUiStore';

const SUBSECTIONS: Array<{ id: PlayersSubSection; label: string }> = [
  { id: 'nearby', label: 'Nearby' },
  { id: 'friends', label: 'Friends' },
  { id: 'requests', label: 'Requests' },
];

export function renderPlayersView(root: HTMLElement) {
  const render = () => {
    const state = onlineUiStore.getState();
    const subsection = state.playersSubSection;
    const nearby = onlineUiStore.nearbyPlayers();
    const friends = onlineUiStore.acceptedFriends();
    const requests = onlineUiStore.pendingFriendRequests();
    const rows = subsection === 'nearby' ? nearby : subsection === 'friends' ? friends : requests;

    root.innerHTML = `
      <div class="ll-view ll-players-view">
        <div class="ll-segmented" role="tablist" aria-label="Player lists">
          ${SUBSECTIONS.map((entry) => `
            <button type="button" role="tab" class="ll-segment ${subsection === entry.id ? 'is-active' : ''}"
              aria-selected="${subsection === entry.id}" data-subsection="${entry.id}">
              ${entry.label}
              ${entry.id === 'requests' && requests.length ? `<span class="ll-badge">${requests.length}</span>` : ''}
            </button>`).join('')}
        </div>
        <div class="ll-player-list" role="list">
          ${rows.length ? rows.map((row) => {
            const accountId = row.accountId;
            const displayName = row.displayName;
            const online = 'online' in row ? row.online : true;
            const mapLabel = 'mapId' in row ? `${row.mapId}` : '';
            const isRequest = subsection === 'requests';
            return `
              <div class="ll-player-row-wrap">
                <button type="button" class="ll-player-row" data-player-id="${accountId}" aria-label="View ${displayName}">
                  <span class="ll-avatar" aria-hidden="true">${displayName.slice(0, 1).toUpperCase()}</span>
                  <span class="ll-player-copy">
                    <strong>${displayName}</strong>
                    <small>${subsection === 'nearby' ? mapLabel : online ? 'Online' : 'Offline'}</small>
                  </span>
                </button>
                ${isRequest ? `<button type="button" class="ll-btn" data-accept-friend="${accountId}">Accept</button>` : ''}
              </div>`;
          }).join('') : `<p class="ll-empty">${emptyCopy(subsection)}</p>`}
        </div>
        ${state.selectedPlayerCard ? renderDetail(state.selectedPlayerCard.accountId === state.accountId) : ''}
      </div>`;

    function renderDetail(isSelf: boolean) {
      const card = state.selectedPlayerCard!;
      return `
        <section class="ll-detail-card" aria-label="Player detail">
          <button type="button" class="ll-detail-close" data-detail-close aria-label="Close player detail">×</button>
          <h3>${card.displayName}</h3>
          <p>Crests ${card.crests.length} · Caught ${card.caughtCount}</p>
          <p>Play time ${Math.floor(card.playTimeSeconds / 3600)}h</p>
          <div class="ll-detail-actions">
            ${!isSelf ? `<button type="button" class="ll-btn" data-action="message">Message</button>` : ''}
            ${!isSelf ? `<button type="button" class="ll-btn" data-action="friend">Add Friend</button>` : ''}
            ${!isSelf ? `<button type="button" class="ll-btn" data-action="trade">Trade</button>` : ''}
          </div>
        </section>`;
    }

    root.querySelectorAll('[data-subsection]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = (button as HTMLElement).dataset.subsection as PlayersSubSection;
        onlineUiStore.patch({ playersSubSection: id, selectedPlayerCard: null });
      });
    });

    root.querySelectorAll('[data-player-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const accountId = (button as HTMLElement).dataset.playerId;
        if (accountId) inspectPlayer(accountId);
      });
    });

    root.querySelector('[data-detail-close]')?.addEventListener('click', () => clearSelectedPlayerCard());
    root.querySelector('[data-action="message"]')?.addEventListener('click', () => {
      const card = onlineUiStore.getState().selectedPlayerCard;
      if (!card) return;
      onlineUiStore.patch({ activeChatChannel: 'direct', chatDirectTarget: card.accountId });
      setActiveSection('chat');
    });
    root.querySelector('[data-action="friend"]')?.addEventListener('click', () => {
      const card = onlineUiStore.getState().selectedPlayerCard;
      if (card) requestFriend(card.accountId);
    });
    root.querySelector('[data-action="trade"]')?.addEventListener('click', () => {
      setActiveSection('trade');
      clearSelectedPlayerCard();
    });

    root.querySelectorAll('[data-accept-friend]').forEach((button) => {
      button.addEventListener('click', () => {
        const accountId = (button as HTMLElement).dataset.acceptFriend;
        if (accountId) respondFriend(accountId, true);
      });
    });
  };

  const off = onlineUiStore.subscribe(render);
  render();
  return off;
}

function emptyCopy(subsection: PlayersSubSection) {
  if (subsection === 'nearby') return 'No nearby players in range.';
  if (subsection === 'friends') return 'No friends linked yet.';
  return 'No pending friend requests.';
}
