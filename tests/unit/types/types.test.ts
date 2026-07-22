/**
 * Unit Tests for Type Definitions
 *
 * Tests the exported types and constants.
 */

import {
  TTAProvider,
  DEFAULT_RETRY_OPTIONS,
  TTARequest,
  TTASoundEffectRequest,
  TTAMusicRequest,
  TTAResponse,
  ModelInfo,
  TTACapabilities,
  TTAUsage,
  RetryOptions,
  TTAGenerationType,
} from '../../../src/middleware/types';

// ============================================================
// TESTS
// ============================================================

describe('TTAProvider enum', () => {
  it('should have correct values', () => {
    expect(TTAProvider.ELEVENLABS).toBe('elevenlabs');
    expect(TTAProvider.GOOGLE_LYRIA).toBe('google-lyria');
    expect(TTAProvider.STABILITY_AI).toBe('stability-ai');
  });

  it('should have exactly 3 providers', () => {
    const providers = Object.values(TTAProvider);
    expect(providers).toHaveLength(3);
  });
});

describe('TTAGenerationType', () => {
  it('should support sound_effect and music types', () => {
    const sfx: TTAGenerationType = 'sound_effect';
    const music: TTAGenerationType = 'music';
    expect(sfx).toBe('sound_effect');
    expect(music).toBe('music');
  });
});

describe('DEFAULT_RETRY_OPTIONS', () => {
  it('should have maxRetries of 3', () => {
    expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
  });

  it('should have delayMs of 1000', () => {
    expect(DEFAULT_RETRY_OPTIONS.delayMs).toBe(1000);
  });

  it('should have backoffMultiplier of 2.0', () => {
    expect(DEFAULT_RETRY_OPTIONS.backoffMultiplier).toBe(2.0);
  });

  it('should have maxDelayMs of 30000', () => {
    expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(30000);
  });

  it('should have jitter enabled by default', () => {
    expect(DEFAULT_RETRY_OPTIONS.jitter).toBe(true);
  });

  it('should be a complete RetryOptions object (without deprecated fields)', () => {
    const required: Required<Omit<RetryOptions, 'incrementalBackoff'>> = DEFAULT_RETRY_OPTIONS;
    expect(required).toBeDefined();
  });
});

describe('Discriminated Union (TTARequest)', () => {
  it('should create a sound effect request', () => {
    const request: TTASoundEffectRequest = {
      type: 'sound_effect',
      prompt: 'thunder crash',
      durationSeconds: 5,
      promptInfluence: 0.8,
      loop: false,
    };
    expect(request.type).toBe('sound_effect');
    expect(request.durationSeconds).toBe(5);
  });

  it('should create a music request', () => {
    const request: TTAMusicRequest = {
      type: 'music',
      prompt: 'jazz piano',
      musicLengthMs: 30000,
      forceInstrumental: true,
      seed: 42,
      negativePrompt: 'drums',
    };
    expect(request.type).toBe('music');
    expect(request.musicLengthMs).toBe(30000);
  });

  it('should work as unified TTARequest type', () => {
    const sfxRequest: TTARequest = {
      type: 'sound_effect',
      prompt: 'explosion',
    };
    const musicRequest: TTARequest = {
      type: 'music',
      prompt: 'ambient',
    };
    expect(sfxRequest.type).toBe('sound_effect');
    expect(musicRequest.type).toBe('music');
  });

  it('should discriminate between types correctly', () => {
    const request: TTARequest = {
      type: 'sound_effect',
      prompt: 'rain on roof',
      durationSeconds: 10,
    };

    if (request.type === 'sound_effect') {
      // TypeScript narrows to TTASoundEffectRequest
      expect(request.durationSeconds).toBe(10);
    }
  });
});

describe('Type exports', () => {
  it('should export TTARequest with retry options', () => {
    const request: TTARequest = {
      type: 'sound_effect',
      prompt: 'test',
      retry: {
        maxRetries: 5,
        delayMs: 2000,
        backoffMultiplier: 3.0,
        maxDelayMs: 60000,
        jitter: false,
      },
    };
    expect((request.retry as RetryOptions).maxRetries).toBe(5);
  });

  it('should export TTARequest with deprecated incrementalBackoff', () => {
    const request: TTARequest = {
      type: 'music',
      prompt: 'test',
      retry: {
        incrementalBackoff: true,
      },
    };
    expect((request.retry as RetryOptions).incrementalBackoff).toBe(true);
  });

  it('should export TTAResponse type', () => {
    const response: TTAResponse = {
      audio: [{ data: 'base64data', contentType: 'audio/mpeg', durationMs: 5000 }],
      metadata: {
        provider: 'elevenlabs',
        model: 'eleven_text_to_sound_v2',
        duration: 1000,
        region: 'us-central1',
      },
      usage: {
        audiosGenerated: 1,
        modelId: 'eleven_text_to_sound_v2',
      },
    };
    expect(response.audio).toHaveLength(1);
  });

  it('should export ModelInfo type', () => {
    const model: ModelInfo = {
      id: 'test-model',
      displayName: 'Test Model',
      capabilities: {
        soundEffects: true,
        music: false,
        looping: true,
        instrumentalOnly: false,
        maxDurationSeconds: 30,
      },
      pricingUrl: 'https://example.com/pricing',
    };
    expect(model.capabilities.soundEffects).toBe(true);
  });

  it('should export TTACapabilities type', () => {
    const capabilities: TTACapabilities = {
      soundEffects: true,
      music: true,
      looping: false,
      instrumentalOnly: false,
      maxDurationSeconds: 600,
    };
    expect(capabilities.music).toBe(true);
  });

  it('should export TTAUsage type', () => {
    const usage: TTAUsage = {
      audiosGenerated: 2,
      modelId: 'test',
      inputTokens: 100,
      outputTokens: 50,
    };
    expect(usage.audiosGenerated).toBe(2);
  });
});
