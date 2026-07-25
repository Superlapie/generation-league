import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { canAttemptLiveConnection, disconnectLiveWorld, getReconnectDelayMs, isLoggedIn, markReconnectDelay, readStoredAuth } from './liveNetwork';

describe('stored auth helpers', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    disconnectLiveWorld();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); },
        removeItem: (key: string) => { storage.delete(key); },
        clear: () => { storage.clear(); },
      },
    });
  });

  it('reports guests as not logged in', () => {
    expect(readStoredAuth()).toEqual({});
    expect(isLoggedIn()).toBe(false);
  });

  it('reports linked accounts as logged in', () => {
    localStorage.setItem('generation-league:auth:v1', JSON.stringify({ accountId: 'acct-1', token: 'token-1', displayName: 'ACE' }));
    expect(isLoggedIn()).toBe(true);
    expect(readStoredAuth().displayName).toBe('ACE');
  });

  it('blocks reconnect attempts until the delay expires', () => {
    vi.useFakeTimers();
    markReconnectDelay(3_000);
    expect(canAttemptLiveConnection()).toBe(false);
    expect(getReconnectDelayMs()).toBeGreaterThan(0);
    vi.advanceTimersByTime(3_000);
    expect(canAttemptLiveConnection()).toBe(true);
    vi.useRealTimers();
  });
});
