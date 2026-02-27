/**
 * Unit Tests for BaseTTAProvider
 *
 * Tests the abstract base class functionality including:
 * - Error handling and classification
 * - Request validation
 * - Retry logic
 * - Dry mode
 */

import {
  BaseTTAProvider,
  TTAError,
  InvalidConfigError,
  QuotaExceededError,
  ProviderUnavailableError,
  GenerationFailedError,
  NetworkError,
  CapabilityNotSupportedError,
  setLogLevel,
  getLogLevel,
} from '../../../src/middleware/services/tta/providers/base-tta-provider';
import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  ModelInfo,
  LogLevel,
  DEFAULT_RETRY_OPTIONS,
} from '../../../src/middleware/types';

// ============================================================
// TEST IMPLEMENTATION
// ============================================================

/**
 * Concrete implementation of BaseTTAProvider for testing
 */
class TestTTAProvider extends BaseTTAProvider {
  private models: ModelInfo[];
  public generateFn: (request: TTARequest) => Promise<TTAResponse>;

  constructor(models?: ModelInfo[]) {
    super(TTAProvider.ELEVENLABS);
    this.models = models || [
      {
        id: 'test-sfx-model',
        displayName: 'Test SFX Model',
        capabilities: {
          soundEffects: true,
          music: false,
          looping: true,
          instrumentalOnly: false,
          maxDurationSeconds: 30,
        },
      },
      {
        id: 'test-music-model',
        displayName: 'Test Music Model',
        capabilities: {
          soundEffects: false,
          music: true,
          looping: false,
          instrumentalOnly: false,
          maxDurationSeconds: 600,
        },
      },
      {
        id: 'test-both-model',
        displayName: 'Test Both Model',
        capabilities: {
          soundEffects: true,
          music: true,
          looping: true,
          instrumentalOnly: false,
          maxDurationSeconds: 600,
        },
      },
    ];
    this.generateFn = async () => ({
      audio: [{ data: 'test-audio-data', contentType: 'audio/mpeg' }],
      metadata: { provider: 'test', model: 'test-sfx-model', duration: 100 },
      usage: { audiosGenerated: 1, modelId: 'test-sfx-model' },
    });
  }

  getDisplayName(): string {
    return 'Test Provider';
  }

  listModels(): ModelInfo[] {
    return this.models;
  }

  getDefaultModel(): string {
    return 'test-both-model';
  }

  protected async doGenerate(request: TTARequest): Promise<TTAResponse> {
    return this.executeWithRetry(
      request,
      () => this.generateFn(request),
      'test generation'
    );
  }

  // Expose protected methods for testing
  public testValidateRequest(request: TTARequest): void {
    return this.validateRequest(request);
  }

  public testHandleError(error: Error, context?: string): TTAError {
    return this.handleError(error, context);
  }

  public testIsRateLimitError(error: Error): boolean {
    return this.isRateLimitError(error);
  }

  public testIsRetryableError(error: Error): boolean {
    return this.isRetryableError(error);
  }

  public testResolveRetryConfig(request: TTARequest) {
    return this.resolveRetryConfig(request);
  }

  public testCalculateRetryDelay(attempt: number, config: Required<Omit<import('../../../src/middleware/types').RetryOptions, 'incrementalBackoff'>>) {
    return this.calculateRetryDelay(attempt, config);
  }
}

// ============================================================
// ERROR CLASS TESTS
// ============================================================

describe('TTA Error Classes', () => {
  describe('TTAError', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new TTAError('test-provider', 'GENERATION_FAILED', 'Test message', cause);

      expect(error.provider).toBe('test-provider');
      expect(error.code).toBe('GENERATION_FAILED');
      expect(error.message).toBe('Test message');
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('TTAError');
    });

    it('should format toString correctly', () => {
      const error = new TTAError('test', 'INVALID_CONFIG', 'Config issue');
      expect(error.toString()).toBe('[test] INVALID_CONFIG: Config issue');
    });

    it('should include cause in toString when present', () => {
      const cause = new Error('Root cause');
      const error = new TTAError('test', 'NETWORK_ERROR', 'Failed', cause);
      expect(error.toString()).toContain('caused by: Root cause');
    });
  });

  describe('InvalidConfigError', () => {
    it('should have correct error code', () => {
      const error = new InvalidConfigError('test', 'Bad config');
      expect(error.code).toBe('INVALID_CONFIG');
      expect(error.name).toBe('InvalidConfigError');
    });
  });

  describe('QuotaExceededError', () => {
    it('should have correct error code', () => {
      const error = new QuotaExceededError('test');
      expect(error.code).toBe('QUOTA_EXCEEDED');
      expect(error.name).toBe('QuotaExceededError');
    });

    it('should use default message when none provided', () => {
      const error = new QuotaExceededError('test');
      expect(error.message).toContain('quota');
    });
  });

  describe('ProviderUnavailableError', () => {
    it('should have correct error code', () => {
      const error = new ProviderUnavailableError('test');
      expect(error.code).toBe('PROVIDER_UNAVAILABLE');
      expect(error.name).toBe('ProviderUnavailableError');
    });
  });

  describe('GenerationFailedError', () => {
    it('should have correct error code', () => {
      const error = new GenerationFailedError('test', 'Generation failed');
      expect(error.code).toBe('GENERATION_FAILED');
      expect(error.name).toBe('GenerationFailedError');
    });
  });

  describe('NetworkError', () => {
    it('should have correct error code', () => {
      const error = new NetworkError('test', 'Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
    });
  });

  describe('CapabilityNotSupportedError', () => {
    it('should have correct error code and message', () => {
      const error = new CapabilityNotSupportedError('test', 'sound_effect', 'model-x');
      expect(error.code).toBe('CAPABILITY_NOT_SUPPORTED');
      expect(error.name).toBe('CapabilityNotSupportedError');
      expect(error.message).toContain('sound_effect');
      expect(error.message).toContain('model-x');
    });
  });
});

// ============================================================
// BASE PROVIDER TESTS
// ============================================================

describe('BaseTTAProvider', () => {
  let provider: TestTTAProvider;

  beforeEach(() => {
    provider = new TestTTAProvider();
  });

  describe('getName()', () => {
    it('should return the provider name', () => {
      expect(provider.getName()).toBe(TTAProvider.ELEVENLABS);
    });
  });

  describe('getDisplayName()', () => {
    it('should return human-readable name', () => {
      expect(provider.getDisplayName()).toBe('Test Provider');
    });
  });

  describe('listModels()', () => {
    it('should return available models', () => {
      const models = provider.listModels();
      expect(models).toHaveLength(3);
      expect(models[0].id).toBe('test-sfx-model');
    });
  });

  describe('getDefaultModel()', () => {
    it('should return default model', () => {
      expect(provider.getDefaultModel()).toBe('test-both-model');
    });
  });

  describe('validateRequest()', () => {
    it('should pass for valid sound effect request', () => {
      expect(() => {
        provider.testValidateRequest({ type: 'sound_effect', prompt: 'A thunder crash' });
      }).not.toThrow();
    });

    it('should pass for valid music request', () => {
      expect(() => {
        provider.testValidateRequest({ type: 'music', prompt: 'Jazz piano solo' });
      }).not.toThrow();
    });

    it('should throw for empty prompt', () => {
      expect(() => {
        provider.testValidateRequest({ type: 'sound_effect', prompt: '' });
      }).toThrow(InvalidConfigError);
    });

    it('should throw for whitespace-only prompt', () => {
      expect(() => {
        provider.testValidateRequest({ type: 'music', prompt: '   ' });
      }).toThrow(InvalidConfigError);
    });

    it('should throw when requesting SFX with music-only model', () => {
      expect(() => {
        provider.testValidateRequest({
          type: 'sound_effect',
          prompt: 'test',
          model: 'test-music-model',
        });
      }).toThrow(CapabilityNotSupportedError);
    });

    it('should throw when requesting music with SFX-only model', () => {
      expect(() => {
        provider.testValidateRequest({
          type: 'music',
          prompt: 'test',
          model: 'test-sfx-model',
        });
      }).toThrow(CapabilityNotSupportedError);
    });

    it('should pass when using model that supports both types', () => {
      expect(() => {
        provider.testValidateRequest({
          type: 'sound_effect',
          prompt: 'test',
          model: 'test-both-model',
        });
      }).not.toThrow();

      expect(() => {
        provider.testValidateRequest({
          type: 'music',
          prompt: 'test',
          model: 'test-both-model',
        });
      }).not.toThrow();
    });
  });

  describe('handleError()', () => {
    it('should return TTAError instances unchanged', () => {
      const original = new QuotaExceededError('test');
      const result = provider.testHandleError(original);
      expect(result).toBe(original);
    });

    it('should classify 401 errors as InvalidConfigError', () => {
      const error = provider.testHandleError(new Error('Request failed with status 401'));
      expect(error).toBeInstanceOf(InvalidConfigError);
    });

    it('should classify 403 errors as InvalidConfigError', () => {
      const error = provider.testHandleError(new Error('Request failed with status 403'));
      expect(error).toBeInstanceOf(InvalidConfigError);
    });

    it('should classify 429 errors as QuotaExceededError', () => {
      const error = provider.testHandleError(new Error('Request failed with status 429'));
      expect(error).toBeInstanceOf(QuotaExceededError);
    });

    it('should classify 503 errors as ProviderUnavailableError', () => {
      const error = provider.testHandleError(new Error('Request failed with status 503'));
      expect(error).toBeInstanceOf(ProviderUnavailableError);
    });

    it('should classify timeout errors as NetworkError', () => {
      const error = provider.testHandleError(new Error('Request timeout'));
      expect(error).toBeInstanceOf(NetworkError);
    });

    it('should classify connection errors as NetworkError', () => {
      const error = provider.testHandleError(new Error('ECONNREFUSED'));
      expect(error).toBeInstanceOf(NetworkError);
    });

    it('should classify other errors as GenerationFailedError', () => {
      const error = provider.testHandleError(new Error('Unknown error'));
      expect(error).toBeInstanceOf(GenerationFailedError);
    });

    it('should include context in error message', () => {
      const error = provider.testHandleError(new Error('Failed'), 'during API call');
      expect(error.message).toContain('during API call');
    });
  });

  describe('isRateLimitError() (deprecated, delegates to isRetryableError)', () => {
    it('should detect 429 errors', () => {
      expect(provider.testIsRateLimitError(new Error('status 429'))).toBe(true);
    });

    it('should detect rate limit messages', () => {
      expect(provider.testIsRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
    });
  });

  describe('isRetryableError()', () => {
    // Retryable HTTP status codes
    it('should retry 429 (rate limit)', () => {
      expect(provider.testIsRetryableError(new Error('status 429'))).toBe(true);
    });

    it('should retry 408 (request timeout)', () => {
      expect(provider.testIsRetryableError(new Error('status 408'))).toBe(true);
    });

    it('should retry 500 (internal server error)', () => {
      expect(provider.testIsRetryableError(new Error('status 500'))).toBe(true);
    });

    it('should retry 502 (bad gateway)', () => {
      expect(provider.testIsRetryableError(new Error('status 502'))).toBe(true);
    });

    it('should retry 503 (service unavailable)', () => {
      expect(provider.testIsRetryableError(new Error('status 503'))).toBe(true);
    });

    it('should retry 504 (gateway timeout)', () => {
      expect(provider.testIsRetryableError(new Error('status 504'))).toBe(true);
    });

    // Retryable by description
    it('should retry "rate limit exceeded"', () => {
      expect(provider.testIsRetryableError(new Error('Rate limit exceeded'))).toBe(true);
    });

    it('should retry "quota exceeded"', () => {
      expect(provider.testIsRetryableError(new Error('Quota exceeded'))).toBe(true);
    });

    it('should retry "too many requests"', () => {
      expect(provider.testIsRetryableError(new Error('Too many requests'))).toBe(true);
    });

    it('should retry "resource exhausted"', () => {
      expect(provider.testIsRetryableError(new Error('Resource exhausted'))).toBe(true);
    });

    // Network / timeout errors
    it('should retry on timeout', () => {
      expect(provider.testIsRetryableError(new Error('Request timeout'))).toBe(true);
    });

    it('should retry on ETIMEDOUT', () => {
      expect(provider.testIsRetryableError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('should retry on ECONNRESET', () => {
      expect(provider.testIsRetryableError(new Error('ECONNRESET'))).toBe(true);
    });

    it('should retry on ECONNREFUSED', () => {
      expect(provider.testIsRetryableError(new Error('ECONNREFUSED'))).toBe(true);
    });

    it('should retry on ECONNABORTED', () => {
      expect(provider.testIsRetryableError(new Error('ECONNABORTED'))).toBe(true);
    });

    it('should retry on socket hang up', () => {
      expect(provider.testIsRetryableError(new Error('socket hang up'))).toBe(true);
    });

    // Non-retryable
    it('should NOT retry 401 (unauthorized)', () => {
      expect(provider.testIsRetryableError(new Error('status 401'))).toBe(false);
    });

    it('should NOT retry 403 (forbidden)', () => {
      expect(provider.testIsRetryableError(new Error('status 403'))).toBe(false);
    });

    it('should NOT retry 400 (bad request)', () => {
      expect(provider.testIsRetryableError(new Error('status 400'))).toBe(false);
    });

    it('should NOT retry unknown errors', () => {
      expect(provider.testIsRetryableError(new Error('Invalid prompt format'))).toBe(false);
    });
  });
});

// ============================================================
// RETRY LOGIC TESTS
// ============================================================

describe('Retry Logic', () => {
  let provider: TestTTAProvider;

  beforeEach(() => {
    provider = new TestTTAProvider();
  });

  describe('resolveRetryConfig()', () => {
    it('should return defaults when retry is undefined', () => {
      const config = provider.testResolveRetryConfig({ type: 'sound_effect', prompt: 'test' });
      expect(config).toEqual(DEFAULT_RETRY_OPTIONS);
    });

    it('should return defaults when retry is true', () => {
      const config = provider.testResolveRetryConfig({ type: 'sound_effect', prompt: 'test', retry: true });
      expect(config).toEqual(DEFAULT_RETRY_OPTIONS);
    });

    it('should return null when retry is false', () => {
      const config = provider.testResolveRetryConfig({ type: 'sound_effect', prompt: 'test', retry: false });
      expect(config).toBeNull();
    });

    it('should merge custom config with defaults', () => {
      const config = provider.testResolveRetryConfig({
        type: 'music',
        prompt: 'test',
        retry: { maxRetries: 5 },
      });
      expect(config?.maxRetries).toBe(5);
      expect(config?.delayMs).toBe(DEFAULT_RETRY_OPTIONS.delayMs);
      expect(config?.backoffMultiplier).toBe(DEFAULT_RETRY_OPTIONS.backoffMultiplier);
      expect(config?.maxDelayMs).toBe(DEFAULT_RETRY_OPTIONS.maxDelayMs);
      expect(config?.jitter).toBe(DEFAULT_RETRY_OPTIONS.jitter);
    });

    it('should handle all custom options', () => {
      const config = provider.testResolveRetryConfig({
        type: 'sound_effect',
        prompt: 'test',
        retry: { maxRetries: 5, delayMs: 2000, backoffMultiplier: 3.0, maxDelayMs: 60000, jitter: false },
      });
      expect(config).toEqual({
        maxRetries: 5, delayMs: 2000, backoffMultiplier: 3.0, maxDelayMs: 60000, jitter: false,
        timeoutMs: 45000, timeoutRetries: 2,
      });
    });

    it('should handle deprecated incrementalBackoff gracefully', () => {
      const config = provider.testResolveRetryConfig({
        type: 'music',
        prompt: 'test',
        retry: { incrementalBackoff: true },
      });
      expect(config?.backoffMultiplier).toBeDefined();
      expect(config?.maxRetries).toBe(DEFAULT_RETRY_OPTIONS.maxRetries);
    });
  });

  describe('calculateRetryDelay()', () => {
    const baseConfig = {
      maxRetries: 3, delayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 30000, jitter: false,
      timeoutMs: 45000, timeoutRetries: 2,
    };

    it('should return exponential delays without jitter', () => {
      expect(provider.testCalculateRetryDelay(1, baseConfig)).toBe(1000);  // 1000 * 2^0
      expect(provider.testCalculateRetryDelay(2, baseConfig)).toBe(2000);  // 1000 * 2^1
      expect(provider.testCalculateRetryDelay(3, baseConfig)).toBe(4000);  // 1000 * 2^2
      expect(provider.testCalculateRetryDelay(4, baseConfig)).toBe(8000);  // 1000 * 2^3
    });

    it('should cap delay at maxDelayMs', () => {
      const config = { ...baseConfig, maxDelayMs: 5000 };
      expect(provider.testCalculateRetryDelay(4, config)).toBe(5000); // 8000 capped to 5000
    });

    it('should return constant delay with multiplier 1.0', () => {
      const config = { ...baseConfig, backoffMultiplier: 1.0 };
      expect(provider.testCalculateRetryDelay(1, config)).toBe(1000);
      expect(provider.testCalculateRetryDelay(2, config)).toBe(1000);
      expect(provider.testCalculateRetryDelay(3, config)).toBe(1000);
    });

    it('should apply jitter (delay between 0 and computed)', () => {
      const config = { ...baseConfig, jitter: true };
      for (let i = 0; i < 20; i++) {
        const delay = provider.testCalculateRetryDelay(2, config);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(2000);
      }
    });
  });

  describe('executeWithRetry()', () => {
    it('should succeed on first attempt', async () => {
      const result = await provider.generate({ type: 'sound_effect', prompt: 'test' });
      expect(result.audio).toHaveLength(1);
    });

    it('should retry on rate limit error', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('429 Rate limit exceeded');
        }
        return {
          audio: [{ data: 'data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test' },
        };
      };

      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'test',
        retry: { maxRetries: 2, delayMs: 10 },
      });

      expect(attempts).toBe(2);
      expect(result.audio).toHaveLength(1);
    });

    it('should retry on 503 server error', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('503 Service Unavailable');
        }
        return {
          audio: [{ data: 'data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test' },
        };
      };

      const result = await provider.generate({
        type: 'music',
        prompt: 'test',
        retry: { maxRetries: 2, delayMs: 10, jitter: false },
      });

      expect(attempts).toBe(2);
      expect(result.audio).toHaveLength(1);
    });

    it('should retry on network timeout (ETIMEDOUT)', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('ETIMEDOUT');
        }
        return {
          audio: [{ data: 'data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test' },
        };
      };

      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'test',
        retry: { maxRetries: 2, delayMs: 10, jitter: false },
      });

      expect(attempts).toBe(2);
      expect(result.audio).toHaveLength(1);
    });

    it('should not retry on non-retryable errors (401)', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        throw new Error('status 401 Unauthorized');
      };

      await expect(provider.generate({ type: 'sound_effect', prompt: 'test', retry: { maxRetries: 2 } })).rejects.toThrow(
        '401'
      );
      expect(attempts).toBe(1);
    });

    it('should not retry on non-retryable errors (Invalid prompt)', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        throw new Error('Invalid prompt');
      };

      await expect(provider.generate({ type: 'music', prompt: 'test', retry: { maxRetries: 2 } })).rejects.toThrow(
        'Invalid prompt'
      );
      expect(attempts).toBe(1);
    });

    it('should exhaust retries and throw last error', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        throw new Error('429 Rate limit');
      };

      await expect(
        provider.generate({ type: 'sound_effect', prompt: 'test', retry: { maxRetries: 2, delayMs: 10, jitter: false } })
      ).rejects.toThrow('429 Rate limit');
      expect(attempts).toBe(3); // 1 initial + 2 retries
    });

    it('should not retry when retry is disabled', async () => {
      let attempts = 0;
      provider.generateFn = async () => {
        attempts++;
        throw new Error('429 Rate limit');
      };

      await expect(provider.generate({ type: 'sound_effect', prompt: 'test', retry: false })).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should use exponential backoff delays between retries', async () => {
      const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      provider.generateFn = async () => {
        throw new Error('429 Rate limit');
      };

      await expect(
        provider.generate({
          type: 'sound_effect',
          prompt: 'test',
          retry: { maxRetries: 4, delayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 30000, jitter: false },
        })
      ).rejects.toThrow('429 Rate limit');

      expect(sleepSpy).toHaveBeenCalledTimes(4);
      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 4000);
      expect(sleepSpy).toHaveBeenNthCalledWith(4, 8000);

      sleepSpy.mockRestore();
    });

    it('should cap delays at maxDelayMs', async () => {
      const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      provider.generateFn = async () => {
        throw new Error('503 Service Unavailable');
      };

      await expect(
        provider.generate({
          type: 'music',
          prompt: 'test',
          retry: { maxRetries: 4, delayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 3000, jitter: false },
        })
      ).rejects.toThrow('503');

      expect(sleepSpy).toHaveBeenNthCalledWith(1, 1000);
      expect(sleepSpy).toHaveBeenNthCalledWith(2, 2000);
      expect(sleepSpy).toHaveBeenNthCalledWith(3, 3000);
      expect(sleepSpy).toHaveBeenNthCalledWith(4, 3000);

      sleepSpy.mockRestore();
    });

    it('should apply jitter (delays between 0 and computed max)', async () => {
      const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

      provider.generateFn = async () => {
        throw new Error('429 Rate limit');
      };

      await expect(
        provider.generate({
          type: 'sound_effect',
          prompt: 'test',
          retry: { maxRetries: 3, delayMs: 1000, backoffMultiplier: 2.0, maxDelayMs: 30000, jitter: true },
        })
      ).rejects.toThrow('429 Rate limit');

      expect(sleepSpy).toHaveBeenCalledTimes(3);

      const delays = sleepSpy.mock.calls.map((call) => call[0] as number);
      expect(delays[0]).toBeGreaterThanOrEqual(0);
      expect(delays[0]).toBeLessThanOrEqual(1000);
      expect(delays[1]).toBeGreaterThanOrEqual(0);
      expect(delays[1]).toBeLessThanOrEqual(2000);
      expect(delays[2]).toBeGreaterThanOrEqual(0);
      expect(delays[2]).toBeLessThanOrEqual(4000);

      sleepSpy.mockRestore();
    });
  });
});

// ============================================================
// DRY MODE TESTS
// ============================================================

describe('Dry Mode', () => {
  let provider: TestTTAProvider;

  beforeEach(() => {
    provider = new TestTTAProvider();
  });

  describe('generate() with dry: true', () => {
    it('should not call the actual generation function', async () => {
      let generateCalled = false;
      provider.generateFn = async () => {
        generateCalled = true;
        return {
          audio: [{ data: 'real-data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test-both-model', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test-both-model' },
        };
      };

      await provider.generate({ type: 'sound_effect', prompt: 'test prompt', dry: true });

      expect(generateCalled).toBe(false);
    });

    it('should return placeholder audio', async () => {
      const result = await provider.generate({ type: 'sound_effect', prompt: 'test prompt', dry: true });

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0].data).toBeDefined();
      expect(result.audio[0].contentType).toBe('audio/wav');
    });

    it('should return metadata with provider and model', async () => {
      const result = await provider.generate({ type: 'music', prompt: 'test prompt', dry: true });

      expect(result.metadata.provider).toBe(TTAProvider.ELEVENLABS);
      expect(result.metadata.model).toBe('test-both-model');
      expect(result.metadata.duration).toBe(0);
    });

    it('should return usage with correct audio count', async () => {
      const result = await provider.generate({ type: 'sound_effect', prompt: 'test prompt', dry: true });

      expect(result.usage.audiosGenerated).toBe(1);
      expect(result.usage.modelId).toBe('test-both-model');
    });

    it('should use specified model in dry mode response', async () => {
      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'test prompt',
        model: 'test-sfx-model',
        dry: true,
      });

      expect(result.metadata.model).toBe('test-sfx-model');
      expect(result.usage.modelId).toBe('test-sfx-model');
    });

    it('should still validate the request in dry mode', async () => {
      await expect(
        provider.generate({ type: 'sound_effect', prompt: '', dry: true })
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should validate model capabilities in dry mode', async () => {
      await expect(
        provider.generate({
          type: 'sound_effect',
          prompt: 'test',
          model: 'test-music-model', // Music only - no SFX support
          dry: true,
        })
      ).rejects.toThrow(CapabilityNotSupportedError);
    });
  });

  describe('generate() with dry: false or undefined', () => {
    it('should call actual generation when dry is false', async () => {
      let generateCalled = false;
      provider.generateFn = async () => {
        generateCalled = true;
        return {
          audio: [{ data: 'real-data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test-both-model', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test-both-model' },
        };
      };

      await provider.generate({ type: 'sound_effect', prompt: 'test', dry: false });

      expect(generateCalled).toBe(true);
    });

    it('should call actual generation when dry is undefined', async () => {
      let generateCalled = false;
      provider.generateFn = async () => {
        generateCalled = true;
        return {
          audio: [{ data: 'real-data', contentType: 'audio/mpeg' }],
          metadata: { provider: 'test', model: 'test-both-model', duration: 100 },
          usage: { audiosGenerated: 1, modelId: 'test-both-model' },
        };
      };

      await provider.generate({ type: 'music', prompt: 'test' });

      expect(generateCalled).toBe(true);
    });

    it('should return actual audio when not in dry mode', async () => {
      const result = await provider.generate({ type: 'sound_effect', prompt: 'test' });

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0].data).toBe('test-audio-data');
    });
  });
});

// ============================================================
// LOG LEVEL TESTS
// ============================================================

describe('Log Level', () => {
  const originalLogLevel = getLogLevel();

  afterEach(() => {
    setLogLevel(originalLogLevel);
  });

  it('should set and get log level', () => {
    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
  });

  it('should filter log messages below minimum level', async () => {
    setLogLevel('error');
    const provider = new TestTTAProvider();

    // info messages should be suppressed when level is error
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

    await provider.generate({ type: 'sound_effect', prompt: 'test', dry: true });

    // info calls should be filtered out
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should log messages at or above minimum level', async () => {
    setLogLevel('info');
    const provider = new TestTTAProvider();

    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

    await provider.generate({ type: 'sound_effect', prompt: 'test', dry: true });

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should suppress all logs in silent mode', () => {
    setLogLevel('silent');
    const provider = new TestTTAProvider();
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Trigger a generation that would normally log
    provider.generate({ type: 'sound_effect', prompt: 'test', dry: true });

    // All console methods should be silent
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

// ============================================================
// TIMEOUT RETRY TESTS
// ============================================================

describe('Timeout Retries', () => {
  let provider: TestTTAProvider;

  beforeEach(() => {
    provider = new TestTTAProvider();
    // Suppress console output in these tests
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle per-attempt timeout', async () => {
    const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

    let attempts = 0;
    provider.generateFn = async () => {
      attempts++;
      // Simulate a function that takes too long - but we mock withTimeout behavior
      // by throwing a timeout error on first attempt
      if (attempts < 2) {
        throw new Error('timeout: test generation did not complete within 100ms');
      }
      return {
        audio: [{ data: 'data', contentType: 'audio/mpeg' }],
        metadata: { provider: 'test', model: 'test', duration: 100 },
        usage: { audiosGenerated: 1, modelId: 'test' },
      };
    };

    const result = await provider.generate({
      type: 'sound_effect',
      prompt: 'test',
      retry: { maxRetries: 3, delayMs: 10, timeoutMs: 100, timeoutRetries: 2 },
    });

    expect(attempts).toBe(2);
    expect(result.audio).toHaveLength(1);
    // Timeout retries use fixed 2s delay
    expect(sleepSpy).toHaveBeenCalledWith(2000);
    sleepSpy.mockRestore();
  });

  it('should call onRetry callback on retryable errors', async () => {
    const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);
    const onRetrySpy = jest.fn();

    let attempts = 0;
    provider.generateFn = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('429 Rate limit');
      }
      return {
        audio: [{ data: 'data', contentType: 'audio/mpeg' }],
        metadata: { provider: 'test', model: 'test', duration: 100 },
        usage: { audiosGenerated: 1, modelId: 'test' },
      };
    };

    // We need to test the onRetry callback — but it's only accessible through
    // the executeWithRetry method which is called by doGenerate. The TestTTAProvider's
    // doGenerate doesn't pass onRetry. So let's extend it.
    class TestWithOnRetry extends TestTTAProvider {
      protected async doGenerate(request: TTARequest): Promise<TTAResponse> {
        return this.executeWithRetry(
          request,
          () => this.generateFn(request),
          'test generation',
          { onRetry: onRetrySpy }
        );
      }
    }

    const retryProvider = new TestWithOnRetry();
    retryProvider.generateFn = provider.generateFn;

    const result = await retryProvider.generate({
      type: 'sound_effect',
      prompt: 'test',
      retry: { maxRetries: 3, delayMs: 10 },
    });

    expect(attempts).toBe(3);
    expect(onRetrySpy).toHaveBeenCalledTimes(2);
    expect(onRetrySpy).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetrySpy).toHaveBeenCalledWith(expect.any(Error), 2);
    sleepSpy.mockRestore();
  });

  it('should exhaust timeout retry budget', async () => {
    const sleepSpy = jest.spyOn(provider as any, 'sleep').mockResolvedValue(undefined);

    provider.generateFn = async () => {
      throw new Error('timeout: test generation did not complete within 100ms');
    };

    await expect(
      provider.generate({
        type: 'sound_effect',
        prompt: 'test',
        retry: { maxRetries: 3, delayMs: 10, timeoutMs: 100, timeoutRetries: 1 },
      })
    ).rejects.toThrow('timeout:');

    sleepSpy.mockRestore();
  });
});
