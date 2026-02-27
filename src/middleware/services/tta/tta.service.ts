/**
 * TTA Service
 *
 * Main entry point for Text-to-Audio generation.
 * Manages providers and routes requests to the appropriate provider.
 */

import { BaseTTAProvider, InvalidConfigError } from './providers';
import {
  TTARequest,
  TTAResponse,
  TTAProvider,
  ModelInfo,
  TTACapabilities,
} from '../../types';

export class TTAService {
  private providers: Map<TTAProvider, BaseTTAProvider> = new Map();
  private defaultProvider: TTAProvider = TTAProvider.ELEVENLABS;

  constructor() {
    // Check for default provider from environment
    const envDefault = process.env.TTA_DEFAULT_PROVIDER?.toLowerCase();
    if (envDefault) {
      const parsed = this.parseProvider(envDefault);
      if (parsed) {
        this.defaultProvider = parsed;
      }
    }
  }

  /**
   * Parse a string to TTAProvider enum
   */
  private parseProvider(value: string): TTAProvider | null {
    const normalized = value.toLowerCase().trim();
    const providerMap: Record<string, TTAProvider> = {
      // ElevenLabs
      elevenlabs: TTAProvider.ELEVENLABS,
      eleven_labs: TTAProvider.ELEVENLABS,
      'eleven-labs': TTAProvider.ELEVENLABS,
      eleven: TTAProvider.ELEVENLABS,
      // Google Lyria
      'google-lyria': TTAProvider.GOOGLE_LYRIA,
      google_lyria: TTAProvider.GOOGLE_LYRIA,
      googlelyria: TTAProvider.GOOGLE_LYRIA,
      lyria: TTAProvider.GOOGLE_LYRIA,
    };
    return providerMap[normalized] || null;
  }

  /**
   * Register a TTA provider
   */
  registerProvider(provider: BaseTTAProvider): void {
    this.providers.set(provider.getName(), provider);
    console.log(`[TTAService] Registered provider: ${provider.getDisplayName()}`);
  }

  /**
   * Get a registered provider
   */
  getProvider(name: TTAProvider): BaseTTAProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Get all registered providers
   */
  getAvailableProviders(): TTAProvider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available
   */
  isProviderAvailable(provider: TTAProvider): boolean {
    return this.providers.has(provider);
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): TTAProvider {
    return this.defaultProvider;
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(provider: TTAProvider): void {
    if (!this.providers.has(provider)) {
      console.warn(
        `[TTAService] Provider ${provider} is not registered. Setting as default anyway.`
      );
    }
    this.defaultProvider = provider;
  }

  /**
   * List all models available across all registered providers
   */
  listAllModels(): Array<{ provider: TTAProvider; models: ModelInfo[] }> {
    const result: Array<{ provider: TTAProvider; models: ModelInfo[] }> = [];

    for (const [name, provider] of this.providers) {
      result.push({
        provider: name,
        models: provider.listModels(),
      });
    }

    return result;
  }

  /**
   * Find providers that support a specific capability
   */
  findProvidersWithCapability(
    capability: keyof TTACapabilities
  ): Array<{ provider: TTAProvider; models: ModelInfo[] }> {
    const result: Array<{ provider: TTAProvider; models: ModelInfo[] }> = [];

    for (const [name, provider] of this.providers) {
      const supportingModels = provider
        .listModels()
        .filter((m) => m.capabilities[capability] as boolean);

      if (supportingModels.length > 0) {
        result.push({
          provider: name,
          models: supportingModels,
        });
      }
    }

    return result;
  }

  /**
   * Generate audio
   *
   * @param request The generation request
   * @param provider Optional provider to use (defaults to default provider)
   */
  async generate(request: TTARequest, provider?: TTAProvider): Promise<TTAResponse> {
    const providerKey = provider || this.defaultProvider;
    const providerInstance = this.providers.get(providerKey);

    if (!providerInstance) {
      // Try to find any registered provider as fallback
      if (this.providers.size > 0) {
        const entries = Array.from(this.providers.entries());
        const [fallbackKey, fallbackProvider] = entries[0];
        console.warn(
          `[TTAService] Provider ${providerKey} not found. Using fallback: ${fallbackKey}`
        );
        return fallbackProvider.generate(request);
      }

      throw new InvalidConfigError(
        'TTAService',
        `Provider '${providerKey}' not found and no other providers registered.`
      );
    }

    return providerInstance.generate(request);
  }
}
