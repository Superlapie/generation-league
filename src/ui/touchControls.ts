/** Touch control visibility — hide on desktop fine-pointer, show on coarse/touch devices. */

export function shouldShowTouchControls(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(max-width: 900px)').matches) return true;
  if (window.matchMedia('(pointer: coarse)').matches) return true;
  return navigator.maxTouchPoints > 0;
}

export function syncTouchControlVisibility(): void {
  if (typeof document === 'undefined') return;
  const show = shouldShowTouchControls();
  document.body.dataset.touchInput = show ? 'true' : 'false';
  const el = document.getElementById('touch-controls');
  if (el) {
    el.hidden = !show;
    el.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
}

export function initTouchControls(): () => void {
  syncTouchControlVisibility();
  const mq = window.matchMedia('(pointer: coarse)');
  const onChange = () => syncTouchControlVisibility();
  mq.addEventListener('change', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    mq.removeEventListener('change', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}
