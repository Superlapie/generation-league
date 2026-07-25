type AuthOverlayHandlers = {
  onSubmit: (mode: 'login' | 'register', username: string, password: string) => void;
  onGuestContinue?: () => void;
  onClose?: () => void;
};

let overlay: HTMLElement | null = null;
let handlers: AuthOverlayHandlers = { onSubmit: () => undefined };

function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement('section');
  overlay.className = 'auth-overlay';
  overlay.setAttribute('aria-label', 'Cloud account');
  overlay.innerHTML = `
    <div class="auth-shell">
      <div class="auth-brand"><span class="auth-mark">GL</span><div><p>GENERATION LEAGUE</p><h1>Protect your journey</h1></div></div>
      <div class="auth-layout">
        <div class="auth-intro"><span class="auth-kicker">CLOUD IDENTITY</span><h2>Continue your adventure across worlds.</h2><p>Link your save to keep your profile, party, and progress available wherever you play.</p><div class="auth-worlds"><span>01</span><span>02</span><span>03</span><b>SHARED WORLDS</b></div></div>
        <form class="auth-card" data-auth-form>
          <div class="auth-card-head"><div><span class="auth-kicker">ACCOUNT ACCESS</span><h2>Sign in or register</h2></div><button type="button" class="auth-close" data-auth-close aria-label="Close account window">×</button></div>
          <label>DISPLAY NAME<input name="username" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" autocomplete="username" placeholder="3-16 letters, numbers, or _" required></label>
          <label>PASSWORD<input name="password" type="password" minlength="8" maxlength="128" autocomplete="current-password" placeholder="8-128 characters" required></label>
          <div class="auth-actions"><button type="submit" data-auth="login">SIGN IN <span>↗</span></button><button type="submit" data-auth="register">CREATE ACCOUNT <span>+</span></button></div>
          <p class="auth-status" data-auth-status aria-live="polite"></p>
          <p class="auth-note" data-auth-note>Your guest save remains on this device until you link it.</p>
          <button type="button" class="auth-guest" data-auth-guest hidden>CONTINUE AS GUEST</button>
        </form>
      </div>
    </div>`;
  document.body.append(overlay);
  const form = overlay.querySelector('[data-auth-form]') as HTMLFormElement;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    const values = new FormData(form);
    const username = String(values.get('username') ?? '').trim();
    const password = String(values.get('password') ?? '');
    if (!form.reportValidity()) return;
    handlers.onSubmit(submitter?.dataset.auth === 'register' ? 'register' : 'login', username, password);
  });
  overlay.querySelector('[data-auth-close]')?.addEventListener('click', () => {
    if (handlers.onClose) handlers.onClose();
    else hideAuthOverlay();
  });
  overlay.querySelector('[data-auth-guest]')?.addEventListener('click', () => handlers.onGuestContinue?.());
}

export function configureAuthOverlay(next: AuthOverlayHandlers) {
  handlers = next;
}

export function showAuthOverlay(options: { gate?: boolean; status?: string } = {}) {
  ensureOverlay();
  const guest = overlay!.querySelector('[data-auth-guest]') as HTMLButtonElement | null;
  const close = overlay!.querySelector('[data-auth-close]') as HTMLButtonElement | null;
  const note = overlay!.querySelector('[data-auth-note]') as HTMLElement | null;
  if (guest) guest.hidden = !options.gate;
  if (close) close.hidden = options.gate === true;
  if (note) note.textContent = options.gate ? 'Sign in to sync progress across devices, or continue as a guest on this device only.' : 'Your guest save remains on this device until you link it.';
  if (options.status !== undefined) setAuthOverlayStatus(options.status);
  overlay!.hidden = false;
}

export function hideAuthOverlay() {
  if (!overlay) return;
  overlay.hidden = true;
}

export function removeAuthOverlay() {
  overlay?.remove();
  overlay = null;
}

export function setAuthOverlayStatus(status: string) {
  ensureOverlay();
  const node = overlay!.querySelector('[data-auth-status]');
  if (node) node.textContent = status;
}

export function isAuthOverlayVisible() {
  return Boolean(overlay && !overlay.hidden);
}
