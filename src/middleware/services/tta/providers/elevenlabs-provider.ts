/**
 * ElevenLabs TTA Provider
 *
 * Supports both sound effect and music generation via the ElevenLabs API.
 * SDK: @elevenlabs/elevenlabs-js (lazy-loaded)
 */

import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  ModelInfo,
  TTACapabilities,
} from '../../../types';
import { BaseTTAProvider, InvalidConfigError, GenerationFailedError } from './base-tta-provider';
import { TTADebugger, TTADebugInfo } from '../utils/debug-tta.utils';

// ============================================================
// CONFIGURATION
// ============================================================

export interface ElevenLabsTTAProviderConfig {
  /** ElevenLabs API key (or set ELEVENLABS_API_KEY env var) */
  apiKey?: string;
}

// ============================================================
// MODELS
// ============================================================

const ELEVENLABS_MODELS: ModelInfo[] = [
  {
    id: 'eleven_text_to_sound_v2',
    displayName: 'ElevenLabs Sound Effects v2',
    capabilities: {
      soundEffects: true,
      music: false,
      looping: true,
      instrumentalOnly: false,
      maxDurationSeconds: 30,
    },
    pricingUrl: 'https://elevenlabs.io/pricing',
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
    pricingUrl: 'https://elevenlabs.io/pricing',
  },
];

// ============================================================
// PROVIDER
// ============================================================

export class ElevenLabsTTAProvider extends BaseTTAProvider {
  private apiKey: string;
  private client: any = null;

  constructor(config?: ElevenLabsTTAProviderConfig) {
    super(TTAProvider.ELEVENLABS);

    const apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new InvalidConfigError(
        TTAProvider.ELEVENLABS,
        'ElevenLabs API key is required. Provide via config.apiKey or ELEVENLABS_API_KEY env var.'
      );
    }
    this.apiKey = apiKey;
  }

  getDisplayName(): string {
    return 'ElevenLabs';
  }

  listModels(): ModelInfo[] {
    return ELEVENLABS_MODELS;
  }

  getDefaultModel(): string {
    return 'eleven_text_to_sound_v2';
  }

  /**
   * Lazy-load the ElevenLabs SDK
   */
  private async getClient(): Promise<any> {
    if (!this.client) {
      try {
        const { ElevenLabsClient } = await import('@elevenlabs/elevenlabs-js');
        this.client = new ElevenLabsClient({ apiKey: this.apiKey });
      } catch (error) {
        throw new InvalidConfigError(
          this.providerName,
          'Failed to load @elevenlabs/elevenlabs-js. Install it with: npm install @elevenlabs/elevenlabs-js',
          error as Error
        );
      }
    }
    return this.client;
  }

  /**
   * Collect a ReadableStream into a Buffer
   */
  private async streamToBuffer(stream: ReadableStream | NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];

    if ('getReader' in stream) {
      // Web ReadableStream
      const reader = (stream as ReadableStream).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
    } else {
      // Node.js Readable
      for await (const chunk of stream as NodeJS.ReadableStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }

    return Buffer.concat(chunks);
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
      const result = await this.executeWithRetry(
        request,
        async () => {
          const client = await this.getClient();

          if (request.type === 'sound_effect') {
            return this.generateSoundEffect(client, request, modelId);
          } else {
            return this.generateMusic(client, request, modelId);
          }
        },
        `ElevenLabs ${request.type} generation`
      );

      const duration = Date.now() - startTime;
      const response: TTAResponse = {
        audio: result.audio,
        metadata: {
          provider: this.providerName,
          model: modelId,
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
      throw this.handleError(error as Error, `${request.type} generation`);
    }
  }

  private async generateSoundEffect(
    client: any,
    request: TTARequest & { type: 'sound_effect' },
    _modelId: string
  ): Promise<{ audio: TTAResponse['audio'] }> {
    const params: Record<string, unknown> = {
      text: request.prompt,
    };

    if (request.durationSeconds !== undefined) {
      params.duration_seconds = request.durationSeconds;
    }
    if (request.promptInfluence !== undefined) {
      params.prompt_influence = request.promptInfluence;
    }

    // Merge provider options
    if (request.providerOptions) {
      Object.assign(params, request.providerOptions);
    }

    const stream = await client.textToSoundEffects.convert(params);
    const buffer = await this.streamToBuffer(stream);
    const base64 = buffer.toString('base64');

    const contentType = request.outputFormat?.startsWith('wav') ? 'audio/wav' : 'audio/mpeg';

    return {
      audio: [{
        data: base64,
        contentType,
      }],
    };
  }

  private async generateMusic(
    client: any,
    request: TTARequest & { type: 'music' },
    _modelId: string
  ): Promise<{ audio: TTAResponse['audio'] }> {
    const params: Record<string, unknown> = {
      prompt: request.prompt,
    };

    if (request.musicLengthMs !== undefined) {
      params.duration_seconds = Math.round(request.musicLengthMs / 1000);
    }
    if (request.forceInstrumental !== undefined) {
      params.instrumental = request.forceInstrumental;
    }

    // Merge provider options
    if (request.providerOptions) {
      Object.assign(params, request.providerOptions);
    }

    const stream = await client.music.compose(params);
    const buffer = await this.streamToBuffer(stream);
    const base64 = buffer.toString('base64');

    const contentType = request.outputFormat?.startsWith('wav') ? 'audio/wav' : 'audio/mpeg';

    return {
      audio: [{
        data: base64,
        contentType,
      }],
    };
  }
}
