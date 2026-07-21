export type GameKey = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'A' | 'B' | 'MENU' | 'RUN';

const keyMap: Record<string, GameKey | undefined> = {
  ArrowUp:'UP',KeyW:'UP',ArrowDown:'DOWN',KeyS:'DOWN',ArrowLeft:'LEFT',KeyA:'LEFT',ArrowRight:'RIGHT',KeyD:'RIGHT',
  Enter:'A',KeyZ:'A',Space:'A',Escape:'B',KeyX:'B',KeyM:'MENU',ShiftLeft:'RUN',ShiftRight:'RUN',
};

class Controls {
  private held = new Set<GameKey>();
  private fresh = new Set<GameKey>();
  private ready = false;
  init() {
    if (this.ready) return;
    this.ready = true;
    window.addEventListener('keydown', (event) => { const key = keyMap[event.code]; if (!key) return; if (!this.held.has(key)) this.fresh.add(key); this.held.add(key); event.preventDefault(); });
    window.addEventListener('keyup', (event) => { const key = keyMap[event.code]; if (!key) return; this.held.delete(key); event.preventDefault(); });
    document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((button) => {
      const key = button.dataset.key as GameKey;
      const down = (event: Event) => { event.preventDefault(); if (!this.held.has(key)) this.fresh.add(key); this.held.add(key); };
      const up = (event: Event) => { event.preventDefault(); this.held.delete(key); };
      button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up);
    });
  }
  isDown(key: GameKey) { return this.held.has(key); }
  pressed(key: GameKey) { if (!this.fresh.has(key)) return false; this.fresh.delete(key); return true; }
  clear() { this.fresh.clear(); }
}

export const controls = new Controls();
