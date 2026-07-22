/**
 * Unit Tests for StabilityAITTAProvider
 *
 * Tests configuration and validation without making real API calls.
 */

import { TTAProvider } from '../../../src/middleware/types';
import { InvalidConfigError } from '../../../src/middleware/services/tta/providers/base-tta-provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { StabilityAITTAProvider } from '../../../src/middleware/services/tta/providers/stability-ai-provider';

describe('StabilityAITTAProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.STABILITY_AI_API_KEY;
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create with config API key', () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe(TTAProvider.STABILITY_AI);
    });

    it('should create with environment variable API key', () => {
      process.env.STABILITY_AI_API_KEY = 'env-test-key';
      const provider = new StabilityAITTAProvider();
      expect(provider.getName()).toBe(TTAProvider.STABILITY_AI);
    });

    it('should throw when no API key provided', () => {
      expect(() => new StabilityAITTAProvider()).toThrow(InvalidConfigError);
    });

    it('should prefer config API key over env var', () => {
      process.env.STABILITY_AI_API_KEY = 'env-key';
      const provider = new StabilityAITTAProvider({ apiKey: 'config-key' });
      expect(provider.getName()).toBe(TTAProvider.STABILITY_AI);
    });

    it('should accept custom base URL', () => {
      const provider = new StabilityAITTAProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.example.com',
      });
      expect(provider.getName()).toBe(TTAProvider.STABILITY_AI);
    });
  });

  describe('getDisplayName()', () => {
    it('should return "Stability AI (Stable Audio)"', () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      expect(provider.getDisplayName()).toBe('Stability AI (Stable Audio)');
    });
  });

  describe('listModels()', () => {
    it('should return available models', () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      const models = provider.listModels();

      expect(models).toHaveLength(1);

      const model = models[0];
      expect(model.id).toBe('stable-audio-2.5');
      expect(model.capabilities.soundEffects).toBe(true);
      expect(model.capabilities.music).toBe(true);
      expect(model.capabilities.looping).toBe(false);
      expect(model.capabilities.instrumentalOnly).toBe(true);
      expect(model.capabilities.maxDurationSeconds).toBe(190);
    });
  });

  describe('getDefaultModel()', () => {
    it('should return stable-audio-2.5', () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      expect(provider.getDefaultModel()).toBe('stable-audio-2.5');
    });
  });

  describe('generate() validation', () => {
    it('should throw for empty prompt', async () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      await expect(
        provider.generate({ type: 'sound_effect', prompt: '' })
      ).rejects.toThrow(InvalidConfigError);
    });

    it('should throw for whitespace-only prompt', async () => {
      const provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
      await expect(
        provider.generate({ type: 'sound_effect', prompt: '   ' })
      ).rejects.toThrow(InvalidConfigError);
    });
  });

  describe('generate() API call', () => {
    let provider: StabilityAITTAProvider;

    beforeEach(() => {
      provider = new StabilityAITTAProvider({ apiKey: 'test-key' });
    });

    it('should call Stability AI API for sound effects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio: 'base64-audio-data',
          content_type: 'audio/mpeg',
        }),
      });

      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'explosion sound',
        durationSeconds: 5,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer test-key');
      expect(options.headers.Accept).toBe('application/json');

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0].data).toBe('base64-audio-data');
      expect(result.audio[0].contentType).toBe('audio/mpeg');
      expect(result.metadata.provider).toBe('stability-ai');
      expect(result.metadata.model).toBe('stable-audio-2.5');
      expect(result.usage.audiosGenerated).toBe(1);
    });

    it('should call Stability AI API for music', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          audio: 'music-audio-data',
          content_type: 'audio/wav',
        }),
      });

      const result = await provider.generate({
        type: 'music',
        prompt: 'ambient electronic track',
        musicLengthMs: 60000,
        seed: 42,
        negativePrompt: 'vocals',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.audio[0].data).toBe('music-audio-data');
      expect(result.audio[0].contentType).toBe('audio/wav');
    });

    it('should send FormData with correct fields for SFX', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data', content_type: 'audio/mpeg' }),
      });

      await provider.generate({
        type: 'sound_effect',
        prompt: 'rain on roof',
        durationSeconds: 10,
        outputFormat: 'mp3',
      });

      const body = mockFetch.mock.calls[0][1].body as FormData;
      expect(body.get('prompt')).toBe('rain on roof');
      expect(body.get('model')).toBe('stable-audio-2.5');
      expect(body.get('duration')).toBe('10');
      expect(body.get('output_format')).toBe('mp3');
    });

    it('should send FormData with correct fields for music', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data', content_type: 'audio/mpeg' }),
      });

      await provider.generate({
        type: 'music',
        prompt: 'jazz piano',
        musicLengthMs: 30000,
        seed: 123,
        negativePrompt: 'drums',
      });

      const body = mockFetch.mock.calls[0][1].body as FormData;
      expect(body.get('prompt')).toBe('jazz piano');
      expect(body.get('duration')).toBe('30');
      expect(body.get('seed')).toBe('123');
      expect(body.get('negative_prompt')).toBe('drums');
    });

    it('should cap duration at 190 seconds', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data', content_type: 'audio/mpeg' }),
      });

      await provider.generate({
        type: 'music',
        prompt: 'long track',
        musicLengthMs: 600000, // 600 seconds
      });

      const body = mockFetch.mock.calls[0][1].body as FormData;
      expect(body.get('duration')).toBe('190');
    });

    it('should pass providerOptions as FormData fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data', content_type: 'audio/mpeg' }),
      });

      await provider.generate({
        type: 'sound_effect',
        prompt: 'test',
        providerOptions: { steps: 200, guidance_scale: 7 },
      });

      const body = mockFetch.mock.calls[0][1].body as FormData;
      expect(body.get('steps')).toBe('200');
      expect(body.get('guidance_scale')).toBe('7');
    });

    it('should use default content type when API omits it', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data' }),
      });

      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'beep',
      });

      expect(result.audio[0].contentType).toBe('audio/mpeg');
    });

    it('should throw on API error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      await expect(
        provider.generate({ type: 'sound_effect', prompt: 'test' })
      ).rejects.toThrow();
    });

    it('should throw when API returns no audio data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ finish_reason: 'CONTENT_FILTERED' }),
      });

      await expect(
        provider.generate({ type: 'sound_effect', prompt: 'test' })
      ).rejects.toThrow();
    });

    it('should use custom base URL', async () => {
      const customProvider = new StabilityAITTAProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.example.com',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ audio: 'data', content_type: 'audio/mpeg' }),
      });

      await customProvider.generate({
        type: 'sound_effect',
        prompt: 'test',
      });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('https://custom.example.com/v2beta/audio/stable-audio-2/text-to-audio');
    });

    it('should return dry mode response without API call', async () => {
      const result = await provider.generate({
        type: 'sound_effect',
        prompt: 'test',
        dry: true,
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.audio).toHaveLength(1);
      expect(result.metadata.provider).toBe('stability-ai');
      expect(result.metadata.model).toBe('stable-audio-2.5');
    });
  });
});
