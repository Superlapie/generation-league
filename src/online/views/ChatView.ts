import { sendChat, setActiveChatChannel, setViewingChatChannel } from '../onlineUiBridge';
import type { ChatChannel } from '../onlineUiStore';
import { onlineUiStore } from '../onlineUiStore';

const CHANNELS: Array<{ id: ChatChannel; label: string }> = [
  { id: 'local', label: 'Local' },
  { id: 'world', label: 'World' },
  { id: 'direct', label: 'Direct' },
];

const CHAT_LIMIT = 240;

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function resolveName(from: string, state: ReturnType<typeof onlineUiStore.getState>) {
  if (from === state.accountId) return state.displayName || 'You';
  const player = state.onlinePlayers[from];
  if (player) return player.displayName;
  const friend = state.friends.find((entry) => entry.accountId === from);
  if (friend) return friend.displayName;
  return 'Player';
}

export function renderChatView(root: HTMLElement) {
  let stickToBottom = true;

  const render = () => {
    const state = onlineUiStore.getState();
    const messages = state.chatMessages[state.activeChatChannel];

    root.innerHTML = `
      <div class="ll-view ll-chat-view">
        <div class="ll-channel-tabs" role="tablist" aria-label="Chat channels">
          ${CHANNELS.map((channel) => `
            <button type="button" role="tab" class="ll-channel-tab ${state.activeChatChannel === channel.id ? 'is-active' : ''}"
              aria-selected="${state.activeChatChannel === channel.id}" data-channel="${channel.id}">
              ${channel.label}
              ${state.unreadByChannel[channel.id] > 0 ? `<span class="ll-badge">${state.unreadByChannel[channel.id]}</span>` : ''}
            </button>`).join('')}
        </div>
        <div class="ll-chat-feed" data-chat-feed role="log" aria-live="polite" aria-relevant="additions">
          ${messages.length ? messages.map((message) => `
            <article class="ll-chat-message">
              <header><strong>${resolveName(message.from, state)}</strong><time>${formatTime(message.createdAt)}</time></header>
              <p>${escapeHtml(message.body)}</p>
            </article>`).join('') : `<p class="ll-empty">No messages in this channel yet.</p>`}
        </div>
        <form class="ll-chat-form" data-chat-form>
          <textarea name="body" rows="2" maxlength="${CHAT_LIMIT}" placeholder="Type a message…" aria-label="Chat message"></textarea>
          <div class="ll-chat-form-meta">
            <span data-char-count>0 / ${CHAT_LIMIT}</span>
            <button type="submit" class="ll-btn ll-btn-primary" ${state.connectionState !== 'connected' ? 'disabled' : ''}>Send</button>
          </div>
          ${state.chatInputError ? `<p class="ll-inline-error" role="alert">${state.chatInputError}</p>` : ''}
        </form>
      </div>`;

    const feed = root.querySelector('[data-chat-feed]') as HTMLElement | null;
    if (feed && stickToBottom) feed.scrollTop = feed.scrollHeight;

    root.querySelectorAll('[data-channel]').forEach((button) => {
      button.addEventListener('click', () => {
        const channel = (button as HTMLElement).dataset.channel as ChatChannel;
        setActiveChatChannel(channel);
        stickToBottom = true;
      });
    });

    const form = root.querySelector('[data-chat-form]') as HTMLFormElement | null;
    const input = form?.querySelector('textarea') as HTMLTextAreaElement | null;
    const counter = root.querySelector('[data-char-count]');

    input?.addEventListener('focus', () => setViewingChatChannel(onlineUiStore.getState().activeChatChannel));
    input?.addEventListener('blur', () => {
      if (onlineUiStore.getState().activeSection === 'chat') setViewingChatChannel(onlineUiStore.getState().activeChatChannel);
    });
    input?.addEventListener('input', () => {
      if (counter && input) counter.textContent = `${input.value.length} / ${CHAT_LIMIT}`;
    });
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { input.blur(); return; }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        form?.requestSubmit();
      }
    });

    feed?.addEventListener('scroll', () => {
      if (!feed) return;
      stickToBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 48;
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!input) return;
      const body = input.value.trim();
      if (!body) return;
      if (sendChat(body)) {
        input.value = '';
        if (counter) counter.textContent = `0 / ${CHAT_LIMIT}`;
        stickToBottom = true;
      }
    });
  };

  setViewingChatChannel(onlineUiStore.getState().activeChatChannel);
  const off = onlineUiStore.subscribe(render);
  render();
  return () => {
    setViewingChatChannel(null);
    off();
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
