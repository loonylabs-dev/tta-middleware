/**
 * Stability AI TTA Provider (Stable Audio)
 *
 * Supports music and sound effect generation via the Stability AI Platform REST API.
 * Uses native fetch (Node 18+) — no SDK dependency required.
 */

import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  ModelInfo,
} from '../../../types';
import { BaseTTAProvider, InvalidConfigError, GenerationFailedError } from './base-tta-provider';
import { TTADebugger, TTADebugInfo } from '../utils/debug-tta.utils';

// ============================================================
// CONFIGURATION
// ============================================================

export interface StabilityAITTAProviderConfig {
  /** Stability AI API key (or set STABILITY_AI_API_KEY env var) */
  apiKey?: string;
  /** API base URL (default: https://api.stability.ai) */
  baseUrl?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_BASE_URL = 'https://api.stability.ai';
const TEXT_TO_AUDIO_PATH = '/v2beta/audio/stable-audio-2/text-to-audio';

// ============================================================
// MODELS
// ============================================================

const STABILITY_AI_MODELS: ModelInfo[] = [
  {
    id: 'stable-audio-2.5',
    displayName: 'Stable Audio 2.5',
    capabilities: {
      soundEffects: true,
      music: true,
      looping: false,
      instrumentalOnly: true,
      maxDurationSeconds: 190,
    },
    pricingUrl: 'https://platform.stability.ai/pricing',
  },
];

// ============================================================
// PROVIDER
// ============================================================

export class StabilityAITTAProvider extends BaseTTAProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: StabilityAITTAProviderConfig) {
    super(TTAProvider.STABILITY_AI);

    const apiKey = config?.apiKey || process.env.STABILITY_AI_API_KEY;
    if (!apiKey) {
      throw new InvalidConfigError(
        TTAProvider.STABILITY_AI,
        'Stability AI API key is required. Provide via config.apiKey or STABILITY_AI_API_KEY env var.'
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = config?.baseUrl || DEFAULT_BASE_URL;
  }

  getDisplayName(): string {
    return 'Stability AI (Stable Audio)';
  }

  listModels(): ModelInfo[] {
    return STABILITY_AI_MODELS;
  }

  getDefaultModel(): string {
    return 'stable-audio-2.5';
  }

  protected async doGenerate(request: TTARequest): Promise<TTAResponse> {
    const startTime = Date.now();
    const modelId = request.model || this.getDefaultModel();

    let debugInfo: TTADebugInfo | null = null;
    if (TTADebugger.isEnabled) {
      debugInfo = TTADebugger.createDebugInfo(request, this.providerName, modelId);
      await TTADebugger.logRequest(debugInfo);
    }

    try {
      const audioResult = await this.executeWithRetry(
        request,
        async () => this.callStableAudioAPI(request, modelId),
        `StabilityAI ${request.type} generation`
      );

      const duration = Date.now() - startTime;
      const response: TTAResponse = {
        audio: audioResult.audio,
        metadata: {
          provider: this.providerName,
          model: modelId,
          duration,
        },
        usage: {
          audiosGenerated: audioResult.audio.length,
          modelId,
        },
      };

      if (debugInfo) {
        debugInfo = TTADebugger.updateWithResponse(debugInfo, response);
        await TTADebugger.logResponse(debugInfo);
      }

      return response;
    } catch (error) {
      if (debugInfo) {
        debugInfo = TTADebugger.updateWithError(debugInfo, error as Error);
        await TTADebugger.logError(debugInfo);
      }
      throw this.handleError(error as Error, `${request.type} generation`);
    }
  }

  private async callStableAudioAPI(
    request: TTARequest,
    modelId: string
  ): Promise<{ audio: TTAResponse['audio'] }> {
    const formData = this.buildFormData(request, modelId);
    const url = `${this.baseUrl}${TEXT_TO_AUDIO_PATH}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Stability AI API error ${response.status}: ${errorBody}`
      );
    }

    const json = await response.json() as StableAudioResponse;

    if (!json.audio || typeof json.audio !== 'string') {
      throw new GenerationFailedError(
        this.providerName,
        'Stability AI API returned no audio data'
      );
    }

    const contentType = json.content_type || 'audio/mpeg';

    return {
      audio: [
        {
          data: json.audio,
          contentType,
        },
      ],
    };
  }

  private buildFormData(request: TTARequest, modelId: string): FormData {
    const formData = new FormData();

    formData.append('prompt', request.prompt);
    formData.append('model', modelId);

    // Duration handling
    if (request.type === 'sound_effect' && request.durationSeconds !== undefined) {
      formData.append('duration', String(Math.min(request.durationSeconds, 190)));
    } else if (request.type === 'music' && request.musicLengthMs !== undefined) {
      const durationSeconds = Math.min(Math.round(request.musicLengthMs / 1000), 190);
      formData.append('duration', String(durationSeconds));
    }

    // Output format
    if (request.outputFormat) {
      formData.append('output_format', request.outputFormat);
    }

    // Negative prompt (music only)
    if (request.type === 'music' && request.negativePrompt) {
      formData.append('negative_prompt', request.negativePrompt);
    }

    // Seed (music only)
    if (request.type === 'music' && request.seed !== undefined) {
      formData.append('seed', String(request.seed));
    }

    // Merge provider options
    if (request.providerOptions) {
      for (const [key, value] of Object.entries(request.providerOptions)) {
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      }
    }

    return formData;
  }
}

// ============================================================
// API RESPONSE TYPE
// ============================================================

interface StableAudioResponse {
  audio: string;
  content_type?: string;
  finish_reason?: string;
  seed?: number;
}
