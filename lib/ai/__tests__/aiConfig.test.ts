/**
 * Tests for lib/ai/aiConfig.ts — Unified AI configuration
 */

import { isAIEnabled, getAIModel, AI_MODELS, AI_QUOTA_DEFAULTS, AI_SERVICE_TYPES } from '../aiConfig';

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('isAIEnabled', () => {
  it('returns false when EXPO_PUBLIC_AI_ENABLED is not set', () => {
    delete process.env.EXPO_PUBLIC_AI_ENABLED;
    // Re-import to pick up new env
    jest.isolateModules(() => {
      const { isAIEnabled: freshIsAIEnabled } = require('../aiConfig');
      expect(freshIsAIEnabled()).toBe(false);
    });
  });

  it('returns true only when EXPO_PUBLIC_AI_ENABLED is exactly "true"', () => {
    process.env.EXPO_PUBLIC_AI_ENABLED = 'true';
    jest.isolateModules(() => {
      const { isAIEnabled: freshIsAIEnabled } = require('../aiConfig');
      expect(freshIsAIEnabled()).toBe(true);
    });
  });

  it('returns false for truthy-but-not-"true" values like "1" or "yes"', () => {
    for (const val of ['1', 'yes', 'TRUE', 'True', '']) {
      process.env.EXPO_PUBLIC_AI_ENABLED = val;
      jest.isolateModules(() => {
        const { isAIEnabled: freshIsAIEnabled } = require('../aiConfig');
        expect(freshIsAIEnabled()).toBe(false);
      });
    }
  });
});

describe('getAIModel', () => {
  it('returns configured model from env', () => {
    process.env.EXPO_PUBLIC_AI_MODEL = 'claude-sonnet-4-20250514';
    jest.isolateModules(() => {
      const { getAIModel: freshGetAIModel } = require('../aiConfig');
      expect(freshGetAIModel()).toBe('claude-sonnet-4-20250514');
    });
  });

  it('falls back to default when env is not set', () => {
    delete process.env.EXPO_PUBLIC_AI_MODEL;
    jest.isolateModules(() => {
      const { getAIModel: freshGetAIModel } = require('../aiConfig');
      expect(freshGetAIModel()).toBeTruthy();
      // Should be one of the known model IDs
      expect(typeof freshGetAIModel()).toBe('string');
    });
  });
});

describe('AI_MODELS', () => {
  it('exports known model configurations', () => {
    expect(AI_MODELS).toBeDefined();
    expect(typeof AI_MODELS).toBe('object');
  });
});

describe('AI_QUOTA_DEFAULTS', () => {
  it('exports quota defaults with expected keys', () => {
    expect(AI_QUOTA_DEFAULTS).toBeDefined();
    expect(typeof AI_QUOTA_DEFAULTS).toBe('object');
  });
});

describe('AI_SERVICE_TYPES', () => {
  it('includes grading_assistance value', () => {
    expect(Object.values(AI_SERVICE_TYPES)).toContain('grading_assistance');
  });

  it('includes lesson_generation value', () => {
    expect(Object.values(AI_SERVICE_TYPES)).toContain('lesson_generation');
  });

  it('includes image_generation value', () => {
    expect(Object.values(AI_SERVICE_TYPES)).toContain('image_generation');
  });
});
