import type Phaser from 'phaser';

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 320;
const ASPECT_RATIO = INTERNAL_WIDTH / INTERNAL_HEIGHT;

export function pickIntegerScale(availableWidth: number, availableHeight: number): number {
  if (availableWidth <= 0 || availableHeight <= 0) return 1;
  const maxScaleX = Math.floor(availableWidth / INTERNAL_WIDTH);
  const maxScaleY = Math.floor(availableHeight / INTERNAL_HEIGHT);
  return Math.max(1, Math.min(maxScaleX, maxScaleY));
}

export function pickFitScale(availableWidth: number, availableHeight: number): number {
  if (availableWidth <= 0 || availableHeight <= 0) return 1;
  return Math.max(1, Math.min(availableWidth / INTERNAL_WIDTH, availableHeight / INTERNAL_HEIGHT));
}

export function measureGameSlot(gameFrame?: HTMLElement | null): { width: number; height: number } {
  const playLayout = document.querySelector('.play-layout') as HTMLElement | null;
  const column = document.getElementById('game-column');
  const footer = document.querySelector('.game-footer') as HTMLElement | null;

  let width = 0;
  let height = 0;

  if (gameFrame && gameFrame.clientWidth > 0 && gameFrame.clientHeight > 0) {
    width = Math.floor(gameFrame.clientWidth);
    height = Math.floor(gameFrame.clientHeight);
  }

  if (playLayout && column) {
    const columnStyles = getComputedStyle(column);
    const gap = parseFloat(columnStyles.rowGap || columnStyles.gap || '8');
    const footerHeight = footer?.offsetHeight ?? 0;
    width = Math.max(width, Math.floor(column.clientWidth));
    height = Math.max(height, Math.floor(playLayout.clientHeight - footerHeight - gap));
  }

  if (width > 0 && height > 0) {
    return { width, height };
  }

  const desktop = window.matchMedia('(min-width: 901px)').matches;
  const shell = document.getElementById('app-shell');
  const header = document.querySelector('.app-header') as HTMLElement | null;
  const sidebar = document.getElementById('league-link');
  const shellStyles = shell ? getComputedStyle(shell) : null;
  const paddingY = shellStyles
    ? parseFloat(shellStyles.paddingTop) + parseFloat(shellStyles.paddingBottom)
    : 16;
  const paddingX = shellStyles
    ? parseFloat(shellStyles.paddingLeft) + parseFloat(shellStyles.paddingRight)
    : 20;
  const headerHeight = header?.offsetHeight ?? 52;
  const footerHeight = footer?.offsetHeight ?? 22;
  const shellGap = shellStyles ? parseFloat(shellStyles.rowGap || shellStyles.gap || '8') : 8;
  const sidebarWidth = sidebar?.classList.contains('is-collapsed') ? 52 : (sidebar?.offsetWidth ?? 320);
  const playGap = 12;
  const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

  if (!desktop) {
    const fallbackWidth = Math.max(INTERNAL_WIDTH, viewportWidth - paddingX);
    return {
      width: fallbackWidth,
      height: Math.max(INTERNAL_HEIGHT, Math.floor(fallbackWidth / ASPECT_RATIO)),
    };
  }

  return {
    width: Math.max(
      INTERNAL_WIDTH,
      viewportWidth - paddingX - sidebarWidth - playGap,
    ),
    height: Math.max(
      INTERNAL_HEIGHT,
      viewportHeight - paddingY - headerHeight - footerHeight - shellGap,
    ),
  };
}

export function initGameScale(gameFrame: HTMLElement, game: Phaser.Game) {
  const root = document.documentElement;
  const gameShell = document.getElementById('game-shell');
  const gameHost = document.getElementById('game');
  let frameId = 0;
  let kickTimers: number[] = [];

  const syncPhaserDom = () => {
    const domContainer = game.domContainer as HTMLElement | undefined;
    if (domContainer) {
      domContainer.style.width = '100%';
      domContainer.style.height = '100%';
    }
  };

  const apply = () => {
    frameId = 0;
    const canvas = game.canvas;
    if (!canvas) {
      schedule();
      return;
    }

    const { width: availableWidth, height: availableHeight } = measureGameSlot(gameFrame);
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const scale = pickFitScale(availableWidth, availableHeight);
    const displayWidth = Math.max(INTERNAL_WIDTH, Math.round(INTERNAL_WIDTH * scale));
    const displayHeight = Math.max(INTERNAL_HEIGHT, Math.round(INTERNAL_HEIGHT * scale));

    root.style.setProperty('--game-scale', String(scale));

    gameFrame.style.width = '100%';
    gameFrame.style.height = mobile ? `${displayHeight}px` : '100%';
    gameFrame.style.flex = mobile ? '0 0 auto' : '1 1 auto';

    if (gameShell) {
      gameShell.style.width = `${displayWidth}px`;
      gameShell.style.height = `${displayHeight}px`;
    }

    if (gameHost) {
      gameHost.style.width = `${INTERNAL_WIDTH}px`;
      gameHost.style.height = `${INTERNAL_HEIGHT}px`;
      gameHost.style.transform = mobile ? 'none' : `scale(${scale})`;
      gameHost.style.transformOrigin = 'center center';
    }

    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    syncPhaserDom();
    game.scale.resize(INTERNAL_WIDTH, INTERNAL_HEIGHT);
    window.dispatchEvent(new CustomEvent('generation-league:game-scale'));
  };

  const schedule = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = window.requestAnimationFrame(apply);
    });
  };

  const kick = () => {
    schedule();
    for (const delay of [0, 50, 150, 400, 1000]) {
      kickTimers.push(window.setTimeout(schedule, delay));
    }
  };

  const observer = new ResizeObserver(kick);
  observer.observe(gameFrame);
  const column = document.getElementById('game-column');
  const playLayout = document.querySelector('.play-layout');
  const sidebar = document.getElementById('league-link');
  const shell = document.getElementById('app-shell');
  if (column) observer.observe(column);
  if (playLayout) observer.observe(playLayout);
  if (sidebar) observer.observe(sidebar);
  if (shell) observer.observe(shell);
  if (gameShell) observer.observe(gameShell);
  if (gameHost) observer.observe(gameHost);

  window.addEventListener('resize', kick);
  window.addEventListener('generation-league:sidebar-layout', kick);
  window.visualViewport?.addEventListener('resize', kick);
  document.fonts?.ready.then(kick).catch(() => undefined);
  kick();

  return () => {
    observer.disconnect();
    window.removeEventListener('resize', kick);
    window.removeEventListener('generation-league:sidebar-layout', kick);
    window.visualViewport?.removeEventListener('resize', kick);
    for (const timer of kickTimers) window.clearTimeout(timer);
    kickTimers = [];
  };
}
