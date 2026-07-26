import type Phaser from 'phaser';

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 320;

export function pickIntegerScale(availableWidth: number, availableHeight: number): number {
  if (availableWidth <= 0 || availableHeight <= 0) return 1;
  const maxScaleX = Math.floor(availableWidth / INTERNAL_WIDTH);
  const maxScaleY = Math.floor(availableHeight / INTERNAL_HEIGHT);
  return Math.max(1, Math.min(3, maxScaleX, maxScaleY));
}

/**
 * Desktop prefers hard integer presentation. A single 1.5x compact-shell step
 * prevents an unnecessarily tiny 1x game when 2x is physically impossible.
 */
export function pickDesktopScale(availableWidth: number, availableHeight: number): number {
  const integer = pickIntegerScale(availableWidth, availableHeight);
  if (integer >= 2) return integer;
  return availableWidth >= INTERNAL_WIDTH * 1.5 && availableHeight >= INTERNAL_HEIGHT * 1.5 ? 1.5 : 1;
}

export function pickFitScale(availableWidth: number, availableHeight: number): number {
  if (availableWidth <= 0 || availableHeight <= 0) return 1;
  return Math.max(0.1, Math.min(availableWidth / INTERNAL_WIDTH, availableHeight / INTERNAL_HEIGHT));
}

export function measureGameSlot(gameFrame?: HTMLElement | null): { width: number; height: number } {
  const playLayout = document.querySelector('.play-layout') as HTMLElement | null;
  const column = document.getElementById('game-column');
  const footer = document.querySelector('.game-footer') as HTMLElement | null;
  const mobile = window.matchMedia('(max-width: 900px)').matches;

  if (mobile) {
    const shell = document.getElementById('app-shell');
    const header = document.querySelector('.app-header') as HTMLElement | null;
    const shellStyles = shell ? getComputedStyle(shell) : null;
    const columnStyles = column ? getComputedStyle(column) : null;
    const paddingY = shellStyles ? parseFloat(shellStyles.paddingTop) + parseFloat(shellStyles.paddingBottom) : 16;
    const paddingX = shellStyles ? parseFloat(shellStyles.paddingLeft) + parseFloat(shellStyles.paddingRight) : 20;
    const shellGap = shellStyles ? parseFloat(shellStyles.rowGap || shellStyles.gap || '8') : 8;
    const columnGap = columnStyles ? parseFloat(columnStyles.rowGap || columnStyles.gap || '8') : 8;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    return {
      width: Math.max(1, Math.floor((column?.clientWidth || viewportWidth) - (column?.clientWidth ? 0 : paddingX))),
      height: Math.max(1, Math.floor(viewportHeight - paddingY - (header?.offsetHeight ?? 52) - (footer?.offsetHeight ?? 22) - shellGap - columnGap)),
    };
  }

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
    // Small shells are mobile layouts even when a desktop test runner reports a fine pointer.
    const mobile = window.matchMedia('(max-width: 900px)').matches;
    const scale = mobile ? pickFitScale(availableWidth, availableHeight) : pickDesktopScale(availableWidth, availableHeight);
    const displayWidth = Math.max(mobile ? 1 : INTERNAL_WIDTH, Math.round(INTERNAL_WIDTH * scale));
    const displayHeight = Math.max(mobile ? 1 : INTERNAL_HEIGHT, Math.round(INTERNAL_HEIGHT * scale));

    root.style.setProperty('--game-scale', String(scale));

    gameFrame.style.width = '100%';
    gameFrame.style.height = mobile ? `${displayHeight}px` : '100%';
    gameFrame.style.flex = mobile ? '0 0 auto' : '1 1 auto';

    if (gameShell) {
      gameShell.style.width = `${displayWidth}px`;
      gameShell.style.height = `${displayHeight}px`;
    }

    if (gameHost) {
      gameHost.style.width = `${displayWidth}px`;
      gameHost.style.height = `${displayHeight}px`;
      gameHost.style.transform = 'none';
      gameHost.style.transformOrigin = 'center center';
    }

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
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
