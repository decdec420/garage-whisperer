import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/app-store';

// Reset store state before each test
beforeEach(() => {
  useAppStore.setState({
    isRatchetOpen: false,
    ratchetActiveSessionId: null,
    ratchetPrefilledMessage: null,
  });
});

describe('openRatchetPanel', () => {
  it('opens the panel', () => {
    useAppStore.getState().openRatchetPanel();
    expect(useAppStore.getState().isRatchetOpen).toBe(true);
  });

  it('clears ratchetActiveSessionId so a stale session is not loaded', () => {
    // Simulate a previous session being set
    useAppStore.setState({ ratchetActiveSessionId: 'old-session-id' });
    useAppStore.getState().openRatchetPanel();
    expect(useAppStore.getState().ratchetActiveSessionId).toBeNull();
  });

  it('sets prefilled message when provided', () => {
    useAppStore.getState().openRatchetPanel('Check my oil pressure');
    expect(useAppStore.getState().ratchetPrefilledMessage).toBe('Check my oil pressure');
  });

  it('clears prefilled message when not provided', () => {
    useAppStore.setState({ ratchetPrefilledMessage: 'old message' });
    useAppStore.getState().openRatchetPanel();
    expect(useAppStore.getState().ratchetPrefilledMessage).toBeNull();
  });
});

describe('openRatchetWithSession', () => {
  it('opens the panel with a specific session', () => {
    useAppStore.getState().openRatchetWithSession('session-abc');
    const state = useAppStore.getState();
    expect(state.isRatchetOpen).toBe(true);
    expect(state.ratchetActiveSessionId).toBe('session-abc');
  });

  it('clears prefilled message when opening with session', () => {
    useAppStore.setState({ ratchetPrefilledMessage: 'some message' });
    useAppStore.getState().openRatchetWithSession('session-abc');
    expect(useAppStore.getState().ratchetPrefilledMessage).toBeNull();
  });
});

describe('closeRatchetPanel', () => {
  it('closes the panel and clears session and message', () => {
    useAppStore.setState({
      isRatchetOpen: true,
      ratchetActiveSessionId: 'session-xyz',
      ratchetPrefilledMessage: 'hello',
    });
    useAppStore.getState().closeRatchetPanel();
    const state = useAppStore.getState();
    expect(state.isRatchetOpen).toBe(false);
    expect(state.ratchetActiveSessionId).toBeNull();
    expect(state.ratchetPrefilledMessage).toBeNull();
  });
});
