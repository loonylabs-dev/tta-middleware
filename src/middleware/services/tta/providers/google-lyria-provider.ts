/**
 * Google Lyria TTA Provider
 *
 * Supports instrumental music generation via Google Cloud Vertex AI.
 * SDK: @google-cloud/aiplatform (lazy-loaded)
 *
 * Note: Google Lyria only supports music generation, NOT sound effects.
 */

import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  ModelInfo,
} from '../../../types';
import {
  BaseTTAProvider,
  InvalidConfigError,
  CapabilityNotSupportedError,
  GenerationFailedError,
} from './base-tta-provider';
import { TTADebugger, TTADebugInfo } from '../utils/debug-tta.utils';

// ============================================================
// CONFIGURATION
// ============================================================

export interface GoogleLyriaTTAProviderConfig {
  /** Google Cloud project ID (or set GOOGLE_CLOUD_PROJECT env var) */
  projectId?: string;
  /** Google Cloud region (default: us-central1) */
  region?: string;
  /** Path to service account key file (or set GOOGLE_APPLICATION_CREDENTIALS env var) */
  keyFilename?: string;
  /** Service account credentials object (alternative to keyFilename) */
  credentials?: Record<string, unknown>;
}

// ============================================================
// MODELS
// ============================================================

const GOOGLE_LYRIA_MODELS: ModelInfo[] = [
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
    pricingUrl: 'https://cloud.google.com/vertex-ai/pricing',
  },
];

// ============================================================
// PROVIDER
// ============================================================

export class GoogleLyriaTTAProvider extends BaseTTAProvider {
  private projectId: string;
  private region: string;
  private keyFilename?: string;
  private credentials?: Record<string, unknown>;
  private predictionClient: any = null;

  constructor(config?: GoogleLyriaTTAProviderConfig) {
    super(TTAProvider.GOOGLE_LYRIA);

    const projectId =
      config?.projectId ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCLOUD_PROJECT;

    if (!projectId) {
      throw new InvalidConfigError(
        TTAProvider.GOOGLE_LYRIA,
        'Google Cloud project ID is required. Provide via config.projectId or GOOGLE_CLOUD_PROJECT env var.'
      );
    }

    this.projectId = projectId;
    this.region = config?.region || process.env.GOOGLE_CLOUD_REGION || 'us-central1';
    this.keyFilename = config?.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS;
    this.credentials = config?.credentials;
  }

  getDisplayName(): string {
    return 'Google Lyria';
  }

  listModels(): ModelInfo[] {
    return GOOGLE_LYRIA_MODELS;
  }

  getDefaultModel(): string {
    return 'lyria-002';
  }

  /**
   * Override validateRequest to enforce music-only constraint
   */
  protected validateRequest(request: TTARequest): void {
    super.validateRequest(request);

    if (request.type === 'sound_effect') {
      throw new CapabilityNotSupportedError(
        this.providerName,
        'sound_effect',
        request.model || this.getDefaultModel()
      );
    }
  }

  /**
   * Lazy-load the Google Cloud AI Platform SDK
   */
  private async getPredictionClient(): Promise<any> {
    if (!this.predictionClient) {
      try {
        const { PredictionServiceClient } = await import('@google-cloud/aiplatform');

        const clientOptions: any = {
          apiEndpoint: `${this.region}-aiplatform.googleapis.com`,
        };

        if (this.keyFilename) {
          clientOptions.keyFilename = this.keyFilename;
        }
        if (this.credentials) {
          clientOptions.credentials = this.credentials;
        }

        this.predictionClient = new PredictionServiceClient(clientOptions);
      } catch (error) {
        throw new InvalidConfigError(
          this.providerName,
          'Failed to load @google-cloud/aiplatform. Install it with: npm install @google-cloud/aiplatform',
          error as Error
        );
      }
    }
    return this.predictionClient;
  }

  protected async doGenerate(request: TTARequest): Promise<TTAResponse> {
    const startTime = Date.now();
    const modelId = request.model || this.getDefaultModel();

    let debugInfo: TTADebugInfo | null = null;
    if (TTADebugger.isEnabled) {
      debugInfo = TTADebugger.createDebugInfo(request, this.providerName, modelId, {
        region: this.region,
      });
      await TTADebugger.logRequest(debugInfo);
    }

    try {
      const result = await this.executeWithRetry(
        request,
        async () => this.generateMusic(request as TTARequest & { type: 'music' }, modelId),
        'Google Lyria music generation'
      );

      const duration = Date.now() - startTime;
      const response: TTAResponse = {
        audio: result.audio,
        metadata: {
          provider: this.providerName,
          model: modelId,
          region: this.region,
          duration,
        },
        usage: {
          audiosGenerated: result.audio.length,
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
      throw this.handleError(error as Error, 'music generation');
    }
  }

  private async generateMusic(
    request: TTARequest & { type: 'music' },
    modelId: string
  ): Promise<{ audio: TTAResponse['audio'] }> {
    const client = await this.getPredictionClient();

    const endpoint = `projects/${this.projectId}/locations/${this.region}/publishers/google/models/${modelId}`;

    const instance: Record<string, unknown> = {
      prompt: request.prompt,
    };

    if (request.musicLengthMs !== undefined) {
      instance.music_length_ms = request.musicLengthMs;
    }
    if (request.seed !== undefined) {
      instance.seed = request.seed;
    }
    if (request.negativePrompt !== undefined) {
      instance.negative_prompt = request.negativePrompt;
    }

    const parameters: Record<string, unknown> = {};

    // Support sample_count via providerOptions
    if (request.providerOptions?.sampleCount) {
      parameters.sample_count = request.providerOptions.sampleCount;
    }

    // Merge additional provider options
    if (request.providerOptions) {
      const { sampleCount, ...rest } = request.providerOptions;
      Object.assign(parameters, rest);
    }

    const [response] = await client.predict({
      endpoint,
      instances: [{ structValue: { fields: this.toProtobufFields(instance) } }],
      parameters: { structValue: { fields: this.toProtobufFields(parameters) } },
    });

    if (!response.predictions || response.predictions.length === 0) {
      throw new GenerationFailedError(
        this.providerName,
        'No audio generated by Lyria model'
      );
    }

    const audioClips: TTAResponse['audio'] = response.predictions.map(
      (prediction: any) => {
        const audioContent =
          prediction.structValue?.fields?.bytesBase64Encoded?.stringValue ||
          prediction.structValue?.fields?.audioContent?.stringValue ||
          prediction.stringValue;

        if (!audioContent) {
          throw new GenerationFailedError(
            this.providerName,
            'Prediction response missing audioContent'
          );
        }

        return {
          data: audioContent,
          contentType: 'audio/wav',
        };
      }
    );

    return { audio: audioClips };
  }

  /**
   * Convert a plain object to Protobuf Struct fields format.
   */
  private toProtobufFields(obj: Record<string, unknown>): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { numberValue: value };
      } else if (typeof value === 'boolean') {
        fields[key] = { boolValue: value };
      }
    }
    return fields;
  }
}
