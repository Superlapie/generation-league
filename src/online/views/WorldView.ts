import { onlineUiStore } from '../onlineUiStore';
import { ensureWorldConnection, switchWorld } from '../onlineUiBridge';

function connectionLabel(state: string) {
  if (state === 'connected') return 'Connected';
  if (state === 'connecting') return 'Connecting…';
  if (state === 'reconnecting') return 'Reconnecting…';
  return 'Offline';
}

function statusClass(state: string, healthy: boolean) {
  if (state === 'connected' && healthy) return 'is-online';
  if (state === 'connecting' || state === 'reconnecting') return 'is-reconnecting';
  if (!healthy && state !== 'connected') return 'is-offline';
  return healthy ? 'is-online' : 'is-offline';
}

export function renderWorldView(root: HTMLElement) {
  const render = () => {
    const state = onlineUiStore.getState();
    const worlds = state.worlds.length ? state.worlds : [
      { id: 'mossmere', name: 'World 1', players: 0, capacity: 2000, pingMs: null, healthy: true },
      { id: 'cinderstep', name: 'World 2', players: 0, capacity: 2000, pingMs: null, healthy: true },
      { id: 'tideglass', name: 'World 3', players: 0, capacity: 2000, pingMs: null, healthy: true },
    ];
    const nearbyCount = onlineUiStore.nearbyPlayers().length;
    const currentWorld = worlds.find((world) => world.id === state.connectedWorldId);

    root.innerHTML = `
      <div class="ll-view ll-world-view">
        <section class="ll-panel">
          <div class="ll-stat-row"><span>Status</span><strong class="ll-status ${statusClass(state.connectionState, true)}">${connectionLabel(state.connectionState)}</strong></div>
          <div class="ll-stat-row"><span>Shard</span><strong>${currentWorld?.name ?? state.connectedWorldId}</strong></div>
          <div class="ll-stat-row"><span>Ping</span><strong>${state.pingMs === null ? '—' : `${state.pingMs} ms`}</strong></div>
          <div class="ll-stat-row"><span>Nearby</span><strong>${nearbyCount}</strong></div>
        </section>
        <section class="ll-panel">
          <h3 class="ll-subhead">Population Shards</h3>
          <div class="ll-shard-list" role="list">
            ${worlds.map((world) => {
              const selected = world.id === state.selectedWorldId;
              const connected = world.id === state.connectedWorldId;
              const shardStatus = !world.healthy ? 'Offline' : connected ? 'Current' : 'Online';
              const shardClass = !world.healthy ? 'is-offline' : connected ? 'is-current' : 'is-online';
              return `
                <button type="button" class="ll-shard-row ${selected ? 'is-selected' : ''}" data-world-id="${world.id}" aria-pressed="${selected}">
                  <span class="ll-shard-name">${world.name}</span>
                  <span class="ll-shard-meta">${world.players}/${world.capacity}</span>
                  <span class="ll-shard-status ${shardClass}">${shardStatus}</span>
                </button>`;
            }).join('')}
          </div>
        </section>
        <div class="ll-actions">
          <button type="button" class="ll-btn ll-btn-primary" data-world-switch ${state.worldSwitchPending ? 'disabled' : ''}>
            ${state.worldSwitchPending ? 'Switching…' : 'Change Shard'}
          </button>
          <button type="button" class="ll-btn" data-world-refresh>Refresh Directory</button>
        </div>
        ${state.lastError ? `<p class="ll-inline-error" role="alert">${state.lastError}</p>` : ''}
        ${state.lastStatus ? `<p class="ll-inline-note">${state.lastStatus}</p>` : ''}
      </div>`;

    root.querySelectorAll('[data-world-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const worldId = (button as HTMLElement).dataset.worldId;
        if (worldId) onlineUiStore.patch({ selectedWorldId: worldId });
        render();
      });
    });

    root.querySelector('[data-world-switch]')?.addEventListener('click', () => {
      const selected = onlineUiStore.getState().selectedWorldId;
      const connected = onlineUiStore.getState().connectedWorldId;
      if (selected === connected) return;
      const confirmed = window.confirm('Switching shards may interrupt your current online session. Continue?');
      if (!confirmed) return;
      switchWorld(selected);
    });

    root.querySelector('[data-world-refresh]')?.addEventListener('click', () => {
      onlineUiStore.patch({ worldsLoading: true });
      ensureWorldConnection();
    });
  };

  const off = onlineUiStore.subscribe(render);
  render();
  return off;
}
