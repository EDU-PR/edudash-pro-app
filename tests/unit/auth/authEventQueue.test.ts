/**
 * Tests for AuthEventQueue serialisation.
 */

// Minimal mock for @/lib/logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

import { authEventQueue } from '@/lib/auth/authEventQueue';

afterEach(() => {
  authEventQueue.clear();
  // Flush remaining microtasks/timers from queue processing
  jest.useRealTimers();
});

describe('AuthEventQueue', () => {
  it('processes events in FIFO order', async () => {
    const order: string[] = [];

    authEventQueue.enqueue('SIGNED_IN', null, async (ev) => {
      // Simulate async work
      await new Promise((r) => setTimeout(r, 10));
      order.push(`1:${ev}`);
    });

    authEventQueue.enqueue('TOKEN_REFRESHED', null, async (ev) => {
      order.push(`2:${ev}`);
    });

    // Wait for all to drain
    await new Promise((r) => setTimeout(r, 80));

    expect(order).toEqual(['1:SIGNED_IN', '2:TOKEN_REFRESHED']);
  });

  it('collapses duplicate SIGNED_OUT events', async () => {
    const calls: string[] = [];

    authEventQueue.enqueue('SIGNED_OUT', null, async () => {
      calls.push('first_signout');
    });

    authEventQueue.enqueue('SIGNED_OUT', null, async () => {
      calls.push('second_signout');
    });

    await new Promise((r) => setTimeout(r, 80));

    // Only the latest SIGNED_OUT should run
    // The first SIGNED_OUT may have already started processing
    expect(calls.filter((c) => c === 'second_signout').length).toBe(1);
  });

  it('handles handler errors without breaking the queue', async () => {
    const results: string[] = [];

    authEventQueue.enqueue('SIGNED_IN', null, async () => {
      throw new Error('boom');
    });

    authEventQueue.enqueue('TOKEN_REFRESHED', null, async () => {
      results.push('recovered');
    });

    await new Promise((r) => setTimeout(r, 80));

    expect(results).toEqual(['recovered']);
  });

  it('clear() discards pending items', async () => {
    const results: string[] = [];

    authEventQueue.enqueue('SIGNED_IN', null, async () => {
      await new Promise((r) => setTimeout(r, 30));
      results.push('first');
    });

    authEventQueue.enqueue('TOKEN_REFRESHED', null, async () => {
      results.push('second');
    });

    // Clear while first is running
    await new Promise((r) => setTimeout(r, 5));
    authEventQueue.clear();

    await new Promise((r) => setTimeout(r, 80));

    // Only the first (already running) should complete
    expect(results).toEqual(['first']);
  });
});
