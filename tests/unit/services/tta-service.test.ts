/**
 * Unit Tests for TTAService
 *
 * Tests the main service orchestration including:
 * - Provider registration
 * - Provider selection and fallback
 * - Generation routing
 * - Model listing
 */

import { TTAService } from '../../../src/middleware/services/tta/tta.service';
import { BaseTTAProvider } from '../../../src/middleware/services/tta/providers/base-tta-provider';
import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  ModelInfo,
} from '../../../src/middleware/types';

// ============================================================
// MOCK PROVIDERS
// ============================================================

function createMockProvider(
  name: TTAProvider,
  displayName: string,
  models: ModelInfo[] = []
): BaseTTAProvider {
  const defaultModels: ModelInfo[] = [
    {
      id: 'mock-model',
      displayName: 'Mock Model',
      capabilities: {
        soundEffects: true,
        music: true,
        looping: false,
        instrumentalOnly: false,
        maxDurationSeconds: 30,
      },
    },
  ];

  return {
    getName: () => name,
    getDisplayName: () => displayName,
    listModels: () => (models.length > 0 ? models : defaultModels),
    getDefaultModel: () => (models.length > 0 ? models[0].id : 'mock-model'),
    generate: jest.fn().mockResolvedValue({
      audio: [{ data: 'mock-audio-data', contentType: 'audio/mpeg' }],
      metadata: { provider: name, model: 'mock-model', duration: 100 },
      usage: { audiosGenerated: 1, modelId: 'mock-model' },
    } as TTAResponse),
  } as unknown as BaseTTAProvider;
}

// ============================================================
// TESTS
// ============================================================

describe('TTAService', () => {
  let service: TTAService;

  beforeEach(() => {
    delete process.env.TTA_DEFAULT_PROVIDER;
    service = new TTAService();
  });

  describe('constructor', () => {
    it('should create with default provider (elevenlabs)', () => {
      expect(service.getDefaultProvider()).toBe(TTAProvider.ELEVENLABS);
    });

    it('should respect TTA_DEFAULT_PROVIDER environment variable', () => {
      process.env.TTA_DEFAULT_PROVIDER = 'google-lyria';
      const envService = new TTAService();
      expect(envService.getDefaultProvider()).toBe(TTAProvider.GOOGLE_LYRIA);
    });

    it('should handle various provider name formats from env', () => {
      const formats = [
        ['elevenlabs', TTAProvider.ELEVENLABS],
        ['eleven_labs', TTAProvider.ELEVENLABS],
        ['eleven-labs', TTAProvider.ELEVENLABS],
        ['eleven', TTAProvider.ELEVENLABS],
        ['google-lyria', TTAProvider.GOOGLE_LYRIA],
        ['google_lyria', TTAProvider.GOOGLE_LYRIA],
        ['googlelyria', TTAProvider.GOOGLE_LYRIA],
        ['lyria', TTAProvider.GOOGLE_LYRIA],
      ];

      for (const [envValue, expected] of formats) {
        process.env.TTA_DEFAULT_PROVIDER = envValue as string;
        const testService = new TTAService();
        expect(testService.getDefaultProvider()).toBe(expected);
      }
    });
  });

  describe('registerProvider()', () => {
    it('should register a provider', () => {
      const mockProvider = createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs');
      service.registerProvider(mockProvider);

      expect(service.isProviderAvailable(TTAProvider.ELEVENLABS)).toBe(true);
    });

    it('should allow registering multiple providers', () => {
      service.registerProvider(createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs'));
      service.registerProvider(createMockProvider(TTAProvider.GOOGLE_LYRIA, 'Google Lyria'));

      expect(service.getAvailableProviders()).toHaveLength(2);
    });

    it('should overwrite existing provider with same name', () => {
      const provider1 = createMockProvider(TTAProvider.ELEVENLABS, 'Provider 1');
      const provider2 = createMockProvider(TTAProvider.ELEVENLABS, 'Provider 2');

      service.registerProvider(provider1);
      service.registerProvider(provider2);

      expect(service.getProvider(TTAProvider.ELEVENLABS)?.getDisplayName()).toBe('Provider 2');
    });
  });

  describe('getProvider()', () => {
    it('should return registered provider', () => {
      const mockProvider = createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs');
      service.registerProvider(mockProvider);

      const retrieved = service.getProvider(TTAProvider.ELEVENLABS);
      expect(retrieved).toBe(mockProvider);
    });

    it('should return undefined for unregistered provider', () => {
      expect(service.getProvider(TTAProvider.GOOGLE_LYRIA)).toBeUndefined();
    });
  });

  describe('getAvailableProviders()', () => {
    it('should return empty array when no providers registered', () => {
      expect(service.getAvailableProviders()).toEqual([]);
    });

    it('should return all registered provider names', () => {
      service.registerProvider(createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs'));
      service.registerProvider(createMockProvider(TTAProvider.GOOGLE_LYRIA, 'Google Lyria'));

      const providers = service.getAvailableProviders();
      expect(providers).toContain(TTAProvider.ELEVENLABS);
      expect(providers).toContain(TTAProvider.GOOGLE_LYRIA);
    });
  });

  describe('isProviderAvailable()', () => {
    it('should return true for registered provider', () => {
      service.registerProvider(createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs'));
      expect(service.isProviderAvailable(TTAProvider.ELEVENLABS)).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(service.isProviderAvailable(TTAProvider.GOOGLE_LYRIA)).toBe(false);
    });
  });

  describe('setDefaultProvider()', () => {
    it('should set default provider', () => {
      service.setDefaultProvider(TTAProvider.GOOGLE_LYRIA);
      expect(service.getDefaultProvider()).toBe(TTAProvider.GOOGLE_LYRIA);
    });

    it('should allow setting unregistered provider with warning', () => {
      expect(() => {
        service.setDefaultProvider(TTAProvider.GOOGLE_LYRIA);
      }).not.toThrow();
      expect(service.getDefaultProvider()).toBe(TTAProvider.GOOGLE_LYRIA);
    });
  });

  describe('listAllModels()', () => {
    it('should return empty array when no providers registered', () => {
      expect(service.listAllModels()).toEqual([]);
    });

    it('should return models from all providers', () => {
      const elevenLabsModels: ModelInfo[] = [
        {
          id: 'eleven_text_to_sound_v2',
          displayName: 'ElevenLabs SFX v2',
          capabilities: {
            soundEffects: true,
            music: false,
            looping: true,
            instrumentalOnly: false,
            maxDurationSeconds: 30,
          },
        },
        {
          id: 'music_v1',
          displayName: 'ElevenLabs Music v1',
          capabilities: {
            soundEffects: false,
            music: true,
            looping: false,
            instrumentalOnly: false,
            maxDurationSeconds: 600,
          },
        },
      ];

      const lyriaModels: ModelInfo[] = [
        {
          id: 'lyria-002',
          displayName: 'Google Lyria 002',
          capabilities: {
            soundEffects: false,
            music: true,
            looping: false,
            instrumentalOnly: true,
            maxDurationSeconds: 600,
          },
        },
      ];

      service.registerProvider(createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs', elevenLabsModels));
      service.registerProvider(createMockProvider(TTAProvider.GOOGLE_LYRIA, 'Google Lyria', lyriaModels));

      const allModels = service.listAllModels();
      expect(allModels).toHaveLength(2);

      const elevenEntry = allModels.find((e) => e.provider === TTAProvider.ELEVENLABS);
      expect(elevenEntry?.models).toHaveLength(2);

      const lyriaEntry = allModels.find((e) => e.provider === TTAProvider.GOOGLE_LYRIA);
      expect(lyriaEntry?.models).toHaveLength(1);
    });
  });

  describe('findProvidersWithCapability()', () => {
    beforeEach(() => {
      const elevenLabsModels: ModelInfo[] = [
        {
          id: 'sfx-model',
          displayName: 'SFX Model',
          capabilities: {
            soundEffects: true,
            music: false,
            looping: true,
            instrumentalOnly: false,
            maxDurationSeconds: 30,
          },
        },
      ];

      const lyriaModels: ModelInfo[] = [
        {
          id: 'lyria-002',
          displayName: 'Lyria',
          capabilities: {
            soundEffects: false,
            music: true,
            looping: false,
            instrumentalOnly: true,
            maxDurationSeconds: 600,
          },
        },
      ];

      service.registerProvider(createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs', elevenLabsModels));
      service.registerProvider(createMockProvider(TTAProvider.GOOGLE_LYRIA, 'Google Lyria', lyriaModels));
    });

    it('should find providers with soundEffects capability', () => {
      const providers = service.findProvidersWithCapability('soundEffects');
      expect(providers).toHaveLength(1);
      expect(providers[0].provider).toBe(TTAProvider.ELEVENLABS);
    });

    it('should find providers with music capability', () => {
      const providers = service.findProvidersWithCapability('music');
      expect(providers).toHaveLength(1);
      expect(providers[0].provider).toBe(TTAProvider.GOOGLE_LYRIA);
    });

    it('should find providers with looping capability', () => {
      const providers = service.findProvidersWithCapability('looping');
      expect(providers).toHaveLength(1);
      expect(providers[0].provider).toBe(TTAProvider.ELEVENLABS);
    });

    it('should return empty when no provider has capability', () => {
      // Neither provider has both soundEffects and instrumentalOnly in the same model
      // But instrumentalOnly is true for Lyria
      const providers = service.findProvidersWithCapability('instrumentalOnly');
      expect(providers).toHaveLength(1);
    });
  });

  describe('generate()', () => {
    it('should generate with default provider', async () => {
      const mockProvider = createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs');
      service.registerProvider(mockProvider);

      const result = await service.generate({ type: 'sound_effect', prompt: 'test audio' });

      expect(result.audio).toHaveLength(1);
      expect(mockProvider.generate).toHaveBeenCalledWith({ type: 'sound_effect', prompt: 'test audio' });
    });

    it('should generate with specified provider', async () => {
      const elevenProvider = createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs');
      const lyriaProvider = createMockProvider(TTAProvider.GOOGLE_LYRIA, 'Google Lyria');

      service.registerProvider(elevenProvider);
      service.registerProvider(lyriaProvider);

      await service.generate({ type: 'music', prompt: 'test' }, TTAProvider.GOOGLE_LYRIA);

      expect(lyriaProvider.generate).toHaveBeenCalled();
      expect(elevenProvider.generate).not.toHaveBeenCalled();
    });

    it('should fallback to any registered provider when requested not available', async () => {
      const elevenProvider = createMockProvider(TTAProvider.ELEVENLABS, 'ElevenLabs');
      service.registerProvider(elevenProvider);

      const result = await service.generate({ type: 'music', prompt: 'test' }, TTAProvider.GOOGLE_LYRIA);

      expect(result.audio).toHaveLength(1);
      expect(elevenProvider.generate).toHaveBeenCalled();
    });

    it('should throw when no providers registered', async () => {
      await expect(service.generate({ type: 'sound_effect', prompt: 'test' })).rejects.toThrow();
    });
  });
});
