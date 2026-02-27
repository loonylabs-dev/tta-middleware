// ============================================================
// PROVIDER IDENTIFICATION
// ============================================================

/**
 * Available TTA Providers
 * Each provider represents a single backend for audio generation.
 */
export enum TTAProvider {
  /** ElevenLabs - Sound effects and music generation. */
  ELEVENLABS = 'elevenlabs',
  /** Google Lyria (Vertex AI) - Instrumental music generation. */
  GOOGLE_LYRIA = 'google-lyria',
}

// ============================================================
// LOGGING CONFIGURATION
// ============================================================

/**
 * Log levels for provider logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Log level priority (higher = more severe)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

// ============================================================
// GENERATION TYPES
// ============================================================

/**
 * Types of audio generation supported
 */
export type TTAGenerationType = 'sound_effect' | 'music';

// ============================================================
// MODEL CAPABILITIES
// ============================================================

/**
 * Capabilities of a specific TTA model/provider
 */
export interface TTACapabilities {
  /** Can generate sound effects */
  soundEffects: boolean;
  /** Can generate music */
  music: boolean;
  /** Supports looping audio (ElevenLabs SFX only) */
  looping: boolean;
  /** Only generates instrumental music (Google Lyria = true) */
  instrumentalOnly: boolean;
  /** Maximum audio duration in seconds */
  maxDurationSeconds: number;
}

/**
 * Information about a specific model within a provider
 */
export interface ModelInfo {
  /** Internal model ID used in API calls */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** What the model can do */
  capabilities: TTACapabilities;
  /** Link to official pricing page */
  pricingUrl?: string;
}

// ============================================================
// REQUEST TYPES (Discriminated Union)
// ============================================================

/**
 * Base request fields shared by all TTA generation types
 */
export interface TTABaseRequest {
  /** The text prompt describing what audio to generate */
  prompt: string;
  /** Model ID to use (provider-specific) */
  model?: string;
  /** Output format (e.g., 'mp3_44100_128', 'wav', 'pcm_44100') */
  outputFormat?: string;
  /** Additional provider-specific options */
  providerOptions?: Record<string, unknown>;
  /**
   * Retry configuration for rate limit errors (429)
   * - true: use default retry (3 retries, 1s delay)
   * - false: disable retry
   * - RetryOptions: custom configuration
   * Default: true (retry enabled with defaults)
   */
  retry?: boolean | RetryOptions;
  /**
   * Dry mode - validate and log request without making actual API calls.
   * Useful for development and debugging without incurring API costs.
   * Default: false
   */
  dry?: boolean;
}

/**
 * Request for sound effect generation
 */
export interface TTASoundEffectRequest extends TTABaseRequest {
  /** Discriminator: sound effect generation */
  type: 'sound_effect';
  /** Duration in seconds (0.5-30) */
  durationSeconds?: number;
  /** How much the prompt influences generation (0-1) */
  promptInfluence?: number;
  /** Whether the audio should loop seamlessly */
  loop?: boolean;
}

/**
 * Request for music generation
 */
export interface TTAMusicRequest extends TTABaseRequest {
  /** Discriminator: music generation */
  type: 'music';
  /** Music length in milliseconds (3000-600000) */
  musicLengthMs?: number;
  /** Force instrumental-only output */
  forceInstrumental?: boolean;
  /** Seed for reproducible generation */
  seed?: number;
  /** Negative prompt to avoid certain elements (Google Lyria) */
  negativePrompt?: string;
}

/**
 * Discriminated union of all TTA request types
 */
export type TTARequest = TTASoundEffectRequest | TTAMusicRequest;

// ============================================================
// RESPONSE TYPES
// ============================================================

/**
 * Generated audio output
 */
export interface TTAAudio {
  /** Base64-encoded audio data */
  data: string;
  /** MIME type (e.g., 'audio/mpeg', 'audio/wav') */
  contentType: string;
  /** Duration of the audio in milliseconds (if known) */
  durationMs?: number;
}

/**
 * Usage metrics for a generation request
 */
export interface TTAUsage {
  /** Number of audio clips generated */
  audiosGenerated: number;
  /** Model used for generation */
  modelId: string;
  /** Input tokens (for token-based models) */
  inputTokens?: number;
  /** Output tokens (for token-based models) */
  outputTokens?: number;
}

/**
 * Billing information (only if provider returns it)
 */
export interface TTABilling {
  /** Cost of the request */
  cost: number;
  /** Currency */
  currency: string;
  /** Source of the cost information */
  source: 'provider' | 'estimated';
}

/**
 * Response from a TTA generation request
 */
export interface TTAResponse {
  /** Generated audio clips */
  audio: TTAAudio[];

  /** Request metadata */
  metadata: {
    /** Provider that handled the request */
    provider: string;
    /** Model used */
    model: string;
    /** Region where request was processed (if applicable) */
    region?: string;
    /** Request duration in milliseconds */
    duration: number;
  };

  /** Usage metrics */
  usage: TTAUsage;

  /** Billing info (only if provider returns actual costs) */
  billing?: TTABilling;
}

// ============================================================
// ERROR HANDLING
// ============================================================

export type TTAErrorCode =
  | 'INVALID_CONFIG'
  | 'QUOTA_EXCEEDED'
  | 'PROVIDER_UNAVAILABLE'
  | 'GENERATION_FAILED'
  | 'NETWORK_ERROR'
  | 'UNAUTHORIZED'
  | 'CAPABILITY_NOT_SUPPORTED';

// ============================================================
// RETRY CONFIGURATION
// ============================================================

/**
 * Configuration for retry behavior on transient errors.
 *
 * Retryable errors: 429 (rate limit), 408 (timeout), 5xx (server errors),
 * network timeouts, and TCP disconnects.
 *
 * Non-retryable errors: 400, 401, 403, and other client errors.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   * Total attempts = 1 (initial) + maxRetries
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds (default: 1000)
   */
  delayMs?: number;

  /**
   * Backoff multiplier for exponential backoff (default: 2.0)
   * Delay formula: delayMs * (backoffMultiplier ^ (attempt - 1))
   * Set to 1.0 for constant delay.
   */
  backoffMultiplier?: number;

  /**
   * Maximum delay in milliseconds (default: 30000)
   * Caps the computed delay to prevent excessively long waits.
   */
  maxDelayMs?: number;

  /**
   * Enable jitter to randomize delay and prevent thundering herd (default: true)
   * When enabled, actual delay is randomized between 0 and the computed delay.
   */
  jitter?: boolean;

  /**
   * Timeout per attempt in milliseconds (default: 45000 = 45s).
   * If the provider SDK call doesn't resolve within this time,
   * the attempt is aborted and counted as a retryable timeout error.
   * Set to 0 to disable timeout.
   */
  timeoutMs?: number;

  /**
   * Maximum retries specifically for timeout errors (default: 2).
   * Timeout retries are tracked independently from other transient errors
   * (429, 5xx, etc.) which use the general `maxRetries` counter.
   */
  timeoutRetries?: number;

  /**
   * @deprecated Use `backoffMultiplier` instead. Will be removed in v2.0.
   */
  incrementalBackoff?: boolean;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'incrementalBackoff'>> = {
  maxRetries: 3,
  delayMs: 1000,
  backoffMultiplier: 2.0,
  maxDelayMs: 30000,
  jitter: true,
  timeoutMs: 45000,
  timeoutRetries: 2,
};

// ============================================================
// PROVIDER INTERFACE
// ============================================================

/**
 * Interface that all TTA providers must implement
 */
export interface ITTAProvider {
  // Identity
  /** Get the provider identifier */
  getName(): TTAProvider;
  /** Get human-readable display name */
  getDisplayName(): string;

  // Models
  /** List all available models */
  listModels(): ModelInfo[];
  /** Get the default model ID */
  getDefaultModel(): string;

  // Generation
  /** Generate audio from a request */
  generate(request: TTARequest): Promise<TTAResponse>;
}
