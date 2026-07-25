import type { LeagueLinkSection } from './onlineUiStore';
import { openLeagueLink } from './onlineUiBridge';

export type NotificationKind =
  | 'friend-request'
  | 'direct-message'
  | 'trade-request'
  | 'connection-lost'
  | 'reconnected'
  | 'world-changed'
  | 'error';

export interface ToastPayload {
  kind: NotificationKind;
  title: string;
  body: string;
  section?: LeagueLinkSection;
  durationMs?: number;
}

interface ToastRecord extends ToastPayload {
  id: string;
}

let container: HTMLElement | null = null;
const queue: ToastRecord[] = [];
const MAX_VISIBLE = 3;

function ensureContainer() {
  if (container) return container;
  container = document.createElement('div');
  container.className = 'll-notifications';
  container.setAttribute('aria-live', 'polite');
  const mount = document.querySelector('#game-frame');
  (mount ?? document.body).append(container);
  return container;
}

function render() {
  const host = ensureContainer();
  host.replaceChildren();
  queue.slice(0, MAX_VISIBLE).forEach((toast) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `ll-toast ll-toast--${toast.kind}`;
    node.setAttribute('aria-label', `${toast.title}: ${toast.body}`);
    node.innerHTML = `<span class="ll-toast-title">${toast.title}</span><span class="ll-toast-body">${toast.body}</span>`;
    node.addEventListener('click', () => {
      if (toast.section) openLeagueLink(toast.section);
      dismissToast(toast.id);
    });
    host.append(node);
  });
}

function dismissToast(id: string) {
  const index = queue.findIndex((entry) => entry.id === id);
  if (index >= 0) queue.splice(index, 1);
  render();
}

export function pushNotification(payload: ToastPayload) {
  const id = crypto.randomUUID();
  const duration = payload.durationMs ?? (payload.kind === 'error' ? 8_000 : 4_500);
  queue.unshift({ ...payload, id });
  while (queue.length > MAX_VISIBLE + 2) queue.pop();
  render();
  window.setTimeout(() => dismissToast(id), duration);
}

export function clearNotifications() {
  queue.length = 0;
  render();
}
