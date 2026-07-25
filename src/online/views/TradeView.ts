import { acceptTrade, cancelTrade, createTradeListing } from '../onlineUiBridge';
import { SPECIES } from '../../data';
import { gameStore } from '../../state';
import { onlineUiStore } from '../onlineUiStore';

export function renderTradeView(root: HTMLElement) {
  const render = () => {
    const state = onlineUiStore.getState();
    const active = onlineUiStore.openTradeListings();
    const mine = onlineUiStore.myTradeListings();
    const party = gameStore.save?.party ?? [];
    const pendingCreate = state.pendingActions.includes('trade:create');
    const pendingAccept = state.pendingActions.includes('trade:accept');

    root.innerHTML = `
      <div class="ll-view ll-trade-view">
        <section class="ll-panel">
          <h3 class="ll-subhead">Active Listings</h3>
          ${active.length ? active.map((listing) => `
            <div class="ll-trade-row">
              <div>
                <strong>${formatSpecies(listing.offeredSpeciesId)} Lv${listing.offeredLevel}</strong>
                <small>Wants ${listing.requestedSpeciesId ? formatSpecies(listing.requestedSpeciesId) : 'any offer'}</small>
              </div>
              <button type="button" class="ll-btn" data-accept="${listing.id}" ${pendingAccept ? 'disabled' : ''}>Accept</button>
            </div>`).join('') : `<p class="ll-empty">No active listings from other players.</p>`}
        </section>
        <section class="ll-panel">
          <h3 class="ll-subhead">My Listings</h3>
          ${mine.length ? mine.map((listing) => `
            <div class="ll-trade-row">
              <div>
                <strong>${formatSpecies(listing.offeredSpeciesId)} Lv${listing.offeredLevel}</strong>
                <small>${listing.status.toUpperCase()}</small>
              </div>
              <button type="button" class="ll-btn" data-cancel="${listing.id}">Cancel</button>
            </div>`).join('') : `<p class="ll-empty">You have no open listings.</p>`}
        </section>
        <section class="ll-panel">
          <h3 class="ll-subhead">List Party Creature</h3>
          ${party.length ? party.map((creature, index) => `
            <button type="button" class="ll-trade-row ll-trade-list-btn" data-list-index="${index}" ${pendingCreate ? 'disabled' : ''}>
              <strong>${creature.nickname || formatSpecies(creature.speciesId)}</strong>
              <small>Lv${creature.level}</small>
            </button>`).join('') : `<p class="ll-empty">You need a party creature to list a trade.</p>`}
        </section>
        ${state.isGuest ? `<p class="ll-inline-note">Link a cloud account to trade online.</p>` : ''}
        ${state.lastError ? `<p class="ll-inline-error" role="alert">${state.lastError}</p>` : ''}
      </div>`;

    root.querySelectorAll('[data-accept]').forEach((button) => {
      button.addEventListener('click', () => {
        const listingId = (button as HTMLElement).dataset.accept;
        const creature = gameStore.save?.party[0];
        if (!listingId || !creature) {
          onlineUiStore.patch({ lastError: 'You need a party creature to accept a trade.' });
          return;
        }
        acceptTrade(listingId, creature.uid);
      });
    });

    root.querySelectorAll('[data-cancel]').forEach((button) => {
      button.addEventListener('click', () => {
        const listingId = (button as HTMLElement).dataset.cancel;
        if (listingId) cancelTrade(listingId);
      });
    });

    root.querySelectorAll('[data-list-index]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = Number((button as HTMLElement).dataset.listIndex);
        const creature = gameStore.save?.party[index];
        if (!creature) return;
        createTradeListing(creature.uid, creature.speciesId, creature.level);
        onlineUiStore.patch({ lastStatus: `${creature.nickname || formatSpecies(creature.speciesId)} listed for trade.` });
      });
    });
  };

  const off = onlineUiStore.subscribe(render);
  render();
  return off;
}

function formatSpecies(speciesId: string) {
  return SPECIES[speciesId]?.name ?? speciesId;
}
