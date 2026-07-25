import { describe, expect, it, beforeEach } from 'vitest';
import { isLoggedIn, readStoredAuth } from './liveNetwork';

describe('stored auth helpers', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
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
});
