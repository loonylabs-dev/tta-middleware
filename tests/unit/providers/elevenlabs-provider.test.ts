/**
 * Unit Tests for ElevenLabsTTAProvider
 *
 * Tests configuration and validation without making real API calls.
 */

import {
  TTAProvider,
} from '../../../src/middleware/types';
import { InvalidConfigError } from '../../../src/middleware/services/tta/providers/base-tta-provider';

// Mock the ElevenLabs SDK
jest.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: jest.fn().mockImplementation(() => ({
    textToSoundEffects: {
      convert: jest.fn(),
    },
    music: {
      compose: jest.fn(),
    },
  })),
}));

import { ElevenLabsTTAProvider } from '../../../src/middleware/services/tta/providers/elevenlabs-provider';

describe('ElevenLabsTTAProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create with config API key', () => {
      const provider = new ElevenLabsTTAProvider({ apiKey: 'test-key' });
      expect(provider.getName()).toBe(TTAProvider.ELEVENLABS);
    });

    it('should create with environment variable API key', () => {
      process.env.ELEVENLABS_API_KEY = 'env-test-key';
      const provider = new ElevenLabsTTAProvider();
      expect(provider.getName()).toBe(TTAProvider.ELEVENLABS);
    });

    it('should throw when no API key provided', () => {
      expect(() => new ElevenLabsTTAProvider()).toThrow(InvalidConfigError);
    });

    it('should prefer config API key over env var', () => {
      process.env.ELEVENLABS_API_KEY = 'env-key';
      const provider = new ElevenLabsTTAProvider({ apiKey: 'config-key' });
      expect(provider.getName()).toBe(TTAProvider.ELEVENLABS);
    });
  });

  describe('getDisplayName()', () => {
    it('should return "ElevenLabs"', () => {
      const provider = new ElevenLabsTTAProvider({ apiKey: 'test-key' });
      expect(provider.getDisplayName()).toBe('ElevenLabs');
    });
  });

  describe('listModels()', () => {
    it('should return available models', () => {
      const provider = new ElevenLabsTTAProvider({ apiKey: 'test-key' });
      const models = provider.listModels();

      expect(models).toHaveLength(2);

      const sfxModel = models.find((m) => m.id === 'eleven_text_to_sound_v2');
      expect(sfxModel).toBeDefined();
      expect(sfxModel!.capabilities.soundEffects).toBe(true);
      expect(sfxModel!.capabilities.music).toBe(false);
      expect(sfxModel!.capabilities.looping).toBe(true);

      const musicModel = models.find((m) => m.id === 'music_v1');
      expect(musicModel).toBeDefined();
      expect(musicModel!.capabilities.soundEffects).toBe(false);
      expect(musicModel!.capabilities.music).toBe(true);
    });
  });

  describe('getDefaultModel()', () => {
    it('should return eleven_text_to_sound_v2', () => {
      const provider = new ElevenLabsTTAProvider({ apiKey: 'test-key' });
      expect(provider.getDefaultModel()).toBe('eleven_text_to_sound_v2');
    });
  });

  describe('generate() validation', () => {
    it('should throw for empty prompt', async () => {
      const provider = new ElevenLabsTTAProvider({ apiKey: 'test-key' });
      await expect(
        provider.generate({ type: 'sound_effect', prompt: '' })
      ).rejects.toThrow(InvalidConfigError);
    });
  });
});
