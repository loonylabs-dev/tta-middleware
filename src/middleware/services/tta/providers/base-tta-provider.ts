/**
 * Base TTA Provider Abstract Class
 *
 * All providers must extend this class and implement the ITTAProvider interface.
 * Provides common functionality for error handling, logging, and validation.
 */

import {
  TTAProvider,
  TTARequest,
  TTAResponse,
  TTAErrorCode,
  ITTAProvider,
  ModelInfo,
  RetryOptions,
  DEFAULT_RETRY_OPTIONS,
  LogLevel,
  LOG_LEVEL_PRIORITY,
} from '../../../types';
import { TTADebugger, TTADebugInfo } from '../utils/debug-tta.utils';
import {
  DRY_MODE_PLACEHOLDER_AUDIO,
  DRY_MODE_PLACEHOLDER_CONTENT_TYPE,
  DRY_MODE_PLACEHOLDER_DURATION_MS,
} from '../assets/placeholder-audio';

// ============================================================
// ERROR CLASSES
// ============================================================

export class TTAError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: TTAErrorCode,
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TTAError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TTAError);
    }
  }

  toString(): string {
    return `[${this.provider}] ${this.code}: ${this.message}${
      this.cause ? ` (caused by: ${this.cause.message})` : ''
    }`;
  }
}

export class InvalidConfigError extends TTAError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, 'INVALID_CONFIG', message, cause);
    this.name = 'InvalidConfigError';
  }
}

export class QuotaExceededError extends TTAError {
  constructor(provider: string, message?: string, cause?: Error) {
    super(
      provider,
      'QUOTA_EXCEEDED',
      message || 'Provider quota or rate limit exceeded',
      cause
    );
    this.name = 'QuotaExceededError';
  }
}

export class ProviderUnavailableError extends TTAError {
  constructor(provider: string, message?: string, cause?: Error) {
    super(
      provider,
      'PROVIDER_UNAVAILABLE',
      message || 'Provider service is temporarily unavailable',
      cause
    );
    this.name = 'ProviderUnavailableError';
  }
}

export class GenerationFailedError extends TTAError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, 'GENERATION_FAILED', message, cause);
    this.name = 'GenerationFailedError';
  }
}

export class NetworkError extends TTAError {
  constructor(provider: string, message: string, cause?: Error) {
    super(provider, 'NETWORK_ERROR', message, cause);
    this.name = 'NetworkError';
  }
}

export class CapabilityNotSupportedError extends TTAError {
  constructor(provider: string, capability: string, model?: string, cause?: Error) {
    super(
      provider,
      'CAPABILITY_NOT_SUPPORTED',
      model
        ? `Model '${model}' does not support '${capability}'`
        : `Provider does not support '${capability}'`,
      cause
    );
    this.name = 'CapabilityNotSupportedError';
  }
}

// ============================================================
// BASE PROVIDER CLASS
// ============================================================

/**
 * Global log level for all providers
 * Set via TTA_LOG_LEVEL environment variable or setLogLevel()
 */
let globalLogLevel: LogLevel = (process.env.TTA_LOG_LEVEL as LogLevel) || 'info';

/**
 * Set the global log level for all TTA providers
 */
export function setLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

/**
 * Get the current global log level
 */
export function getLogLevel(): LogLevel {
  return globalLogLevel;
}

export abstract class BaseTTAProvider implements ITTAProvider {
  protected readonly providerName: TTAProvider;

  constructor(providerName: TTAProvider) {
    this.providerName = providerName;
  }

  // ============================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ============================================================

  abstract getDisplayName(): string;
  abstract listModels(): ModelInfo[];
  abstract getDefaultModel(): string;

  /**
   * Provider-specific generation implementation.
   * Called by generate() after validation and dry mode checks.
   */
  protected abstract doGenerate(request: TTARequest): Promise<TTAResponse>;

  // ============================================================
  // IMPLEMENTED METHODS
  // ============================================================

  public getName(): TTAProvider {
    return this.providerName;
  }

  /**
   * Generate audio from a request.
   * This is the main entry point that handles:
   * - Request validation
   * - Dry mode (skip API call, return mock response with logging)
   * - Delegation to provider-specific doGenerate()
   */
  public async generate(request: TTARequest): Promise<TTAResponse> {
    // 1. Validate the request
    this.validateRequest(request);

    // 2. Handle dry mode - skip API call, return mock response
    if (request.dry) {
      return this.handleDryMode(request);
    }

    // 3. Execute actual generation via provider-specific implementation
    return this.doGenerate(request);
  }

  /**
   * Handle dry mode: log request and return mock response without API call.
   */
  protected async handleDryMode(request: TTARequest): Promise<TTAResponse> {
    const modelId = request.model || this.getDefaultModel();

    this.log('info', 'Dry mode enabled - skipping API call', {
      model: modelId,
      provider: this.providerName,
    });

    let debugInfo: TTADebugInfo | null = null;
    if (TTADebugger.isEnabled) {
      debugInfo = TTADebugger.createDebugInfo(request, this.providerName, modelId);
      await TTADebugger.logRequest(debugInfo);
    }

    const dryResponse = this.createDryModeResponse(request, modelId);

    if (debugInfo) {
      debugInfo = TTADebugger.updateWithResponse(debugInfo, dryResponse);
      await TTADebugger.logResponse(debugInfo);
    }

    return dryResponse;
  }

  /**
   * Create a mock response for dry mode.
   * Returns placeholder audio (1 second silence WAV) with metadata.
   */
  protected createDryModeResponse(request: TTARequest, modelId: string): TTAResponse {
    const audio: TTAResponse['audio'] = [{
      data: DRY_MODE_PLACEHOLDER_AUDIO,
      contentType: DRY_MODE_PLACEHOLDER_CONTENT_TYPE,
      durationMs: DRY_MODE_PLACEHOLDER_DURATION_MS,
    }];

    return {
      audio,
      metadata: {
        provider: this.providerName,
        model: modelId,
        duration: 0,
      },
      usage: {
        audiosGenerated: 1,
        modelId: modelId,
      },
    };
  }

  /**
   * Get model info by ID
   */
  protected getModelInfo(modelId: string): ModelInfo | undefined {
    return this.listModels().find((m) => m.id === modelId);
  }

  /**
   * Validate that the request is valid
   */
  protected validateRequest(request: TTARequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new InvalidConfigError(this.providerName, 'Prompt cannot be empty');
    }

    // Validate generation type against provider capabilities
    const modelId = request.model || this.getDefaultModel();
    const modelInfo = this.getModelInfo(modelId);

    if (modelInfo) {
      if (request.type === 'sound_effect' && !modelInfo.capabilities.soundEffects) {
        throw new CapabilityNotSupportedError(
          this.providerName,
          'sound_effect',
          modelId
        );
      }

      if (request.type === 'music' && !modelInfo.capabilities.music) {
        throw new CapabilityNotSupportedError(
          this.providerName,
          'music',
          modelId
        );
      }
    }
  }

  // ============================================================
  // RETRY LOGIC
  // ============================================================

  protected static readonly RESOLVED_RETRY_DEFAULTS = DEFAULT_RETRY_OPTIONS;

  /**
   * Resolve retry configuration from request
   */
  protected resolveRetryConfig(request: TTARequest): Required<Omit<RetryOptions, 'incrementalBackoff'>> | null {
    const retryOption = request.retry;

    if (retryOption === false) {
      return null;
    }

    if (retryOption === undefined || retryOption === true) {
      return { ...DEFAULT_RETRY_OPTIONS };
    }

    let backoffMultiplier = retryOption.backoffMultiplier ?? DEFAULT_RETRY_OPTIONS.backoffMultiplier;
    if (retryOption.incrementalBackoff !== undefined && retryOption.backoffMultiplier === undefined) {
      backoffMultiplier = retryOption.incrementalBackoff ? 1.0 : 1.0;
    }

    return {
      maxRetries: retryOption.maxRetries ?? DEFAULT_RETRY_OPTIONS.maxRetries,
      delayMs: retryOption.delayMs ?? DEFAULT_RETRY_OPTIONS.delayMs,
      backoffMultiplier,
      maxDelayMs: retryOption.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs,
      jitter: retryOption.jitter ?? DEFAULT_RETRY_OPTIONS.jitter,
      timeoutMs: retryOption.timeoutMs ?? DEFAULT_RETRY_OPTIONS.timeoutMs,
      timeoutRetries: retryOption.timeoutRetries ?? DEFAULT_RETRY_OPTIONS.timeoutRetries,
    };
  }

  /**
   * Calculate delay for a specific retry attempt using exponential backoff.
   */
  protected calculateRetryDelay(
    attempt: number,
    config: Required<Omit<RetryOptions, 'incrementalBackoff'>>
  ): number {
    const exponentialDelay = config.delayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

    if (config.jitter) {
      return Math.round(Math.random() * cappedDelay);
    }

    return Math.round(cappedDelay);
  }

  /**
   * Sleep for a specified duration
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap an operation with a timeout.
   */
  private withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timeout: ${operationName} did not complete within ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private isTimeoutError(error: Error): boolean {
    return error.message.toLowerCase().startsWith('timeout:');
  }

  /**
   * Check if an error is a quota/rate-limit error (429 / Resource Exhausted).
   */
  protected isQuotaError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('resource exhausted') ||
      message.includes('quota exceeded') ||
      message.includes('rate limit') ||
      message.includes('too many requests')
    );
  }

  /**
   * Execute a generation function with retry logic for transient errors.
   */
  protected async executeWithRetry<T>(
    request: TTARequest,
    operation: () => Promise<T>,
    operationName: string,
    options?: {
      onRetry?: (error: Error, generalRetryCount: number) => void;
    }
  ): Promise<T> {
    const retryConfig = this.resolveRetryConfig(request);

    if (!retryConfig) {
      return operation();
    }

    const timeoutMs = retryConfig.timeoutMs || 0;
    const maxTimeoutRetries = retryConfig.timeoutRetries ?? 2;
    let lastError: Error | null = null;
    let generalRetryCount = 0;
    let timeoutRetryCount = 0;
    const maxGeneralRetries = retryConfig.maxRetries;

    const absoluteMaxAttempts = 1 + maxGeneralRetries + maxTimeoutRetries;

    for (let attempt = 1; attempt <= absoluteMaxAttempts; attempt++) {
      const attemptStart = Date.now();

      try {
        this.log(
          'info',
          `${operationName} attempt ${attempt}${timeoutMs ? ` (timeout: ${timeoutMs}ms)` : ''} [retries: general=${generalRetryCount}/${maxGeneralRetries}, timeout=${timeoutRetryCount}/${maxTimeoutRetries}]`,
          {
            attempt,
            timeoutMs: timeoutMs || 'none',
            generalRetries: `${generalRetryCount}/${maxGeneralRetries}`,
            timeoutRetries: `${timeoutRetryCount}/${maxTimeoutRetries}`,
          }
        );

        const result = timeoutMs > 0
          ? await this.withTimeout(operation, timeoutMs, operationName)
          : await operation();

        const duration = Date.now() - attemptStart;
        this.log('info', `${operationName} completed in ${duration}ms`, {
          attempt,
          durationMs: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - attemptStart;
        lastError = error as Error;
        const isTimeout = this.isTimeoutError(error as Error);

        if (!isTimeout && !this.isRetryableError(error as Error)) {
          this.log(
            'error',
            `${operationName} failed with non-retryable error after ${duration}ms: ${(error as Error).message}`,
            { attempt, durationMs: duration }
          );
          throw error;
        }

        if (isTimeout) {
          timeoutRetryCount++;
          if (timeoutRetryCount > maxTimeoutRetries) {
            this.log(
              'error',
              `${operationName} timeout retry budget exhausted (${maxTimeoutRetries} retries, ${duration}ms on last attempt)`,
              { attempt, timeoutRetryCount, durationMs: duration }
            );
            throw error;
          }
          this.log(
            'warn',
            `${operationName} timed out after ${duration}ms. Timeout retry ${timeoutRetryCount}/${maxTimeoutRetries} in 2s...`,
            { attempt, timeoutRetryCount, maxTimeoutRetries, durationMs: duration }
          );
          await this.sleep(2000);
        } else {
          generalRetryCount++;
          if (generalRetryCount > maxGeneralRetries) {
            this.log(
              'error',
              `${operationName} general retry budget exhausted (${maxGeneralRetries} retries): ${(error as Error).message}`,
              { attempt, generalRetryCount, durationMs: duration }
            );
            throw error;
          }
          if (options?.onRetry) {
            options.onRetry(error as Error, generalRetryCount);
          }
          const delay = this.calculateRetryDelay(generalRetryCount, retryConfig);
          this.log(
            'warn',
            `Transient error during ${operationName} after ${duration}ms. Retry ${generalRetryCount}/${maxGeneralRetries} in ${delay}ms: ${(error as Error).message}`,
            { attempt, generalRetryCount, maxGeneralRetries, delayMs: delay, durationMs: duration }
          );
          await this.sleep(delay);
        }
      }
    }

    this.log('error', `All retries exhausted for ${operationName}`, {
      lastError: lastError?.message,
      generalRetryCount,
      timeoutRetryCount,
    });
    throw lastError;
  }

  /**
   * Check if an error is retryable (transient).
   */
  protected isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Non-retryable client errors
    if (
      message.includes('401') ||
      message.includes('403') ||
      message.includes('400') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    ) {
      return false;
    }

    // Retryable HTTP status codes
    if (
      message.includes('429') ||
      message.includes('408') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    ) {
      return true;
    }

    // Retryable by error description
    if (
      message.includes('rate limit') ||
      message.includes('quota exceeded') ||
      message.includes('too many requests') ||
      message.includes('resource exhausted')
    ) {
      return true;
    }

    // Network / timeout errors
    if (
      message.includes('timeout') ||
      message.includes('etimedout') ||
      message.includes('esockettimedout') ||
      message.includes('econnreset') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('econnaborted') ||
      message.includes('epipe') ||
      message.includes('ehostunreach') ||
      message.includes('enetunreach') ||
      message.includes('socket hang up')
    ) {
      return true;
    }

    return false;
  }

  /**
   * @deprecated Use isRetryableError() instead
   */
  protected isRateLimitError(error: Error): boolean {
    return this.isRetryableError(error);
  }

  /**
   * Convert errors to TTAError instances with proper classification
   */
  protected handleError(error: Error, context?: string): TTAError {
    if (error instanceof TTAError) {
      return error;
    }

    const errorMessage = error.message.toLowerCase();

    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return new InvalidConfigError(
        this.providerName,
        `Authentication failed${context ? `: ${context}` : ''}`,
        error
      );
    }

    if (errorMessage.includes('429')) {
      return new QuotaExceededError(
        this.providerName,
        `Rate limit exceeded${context ? `: ${context}` : ''}`,
        error
      );
    }

    if (
      errorMessage.includes('503') ||
      errorMessage.includes('504') ||
      errorMessage.includes('502')
    ) {
      return new ProviderUnavailableError(
        this.providerName,
        `Service temporarily unavailable${context ? `: ${context}` : ''}`,
        error
      );
    }

    if (
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('enotfound')
    ) {
      return new NetworkError(
        this.providerName,
        `Network error${context ? `: ${context}` : ''}`,
        error
      );
    }

    return new GenerationFailedError(
      this.providerName,
      `Generation failed${context ? `: ${context}` : ''}: ${error.message}`,
      error
    );
  }

  /**
   * Log messages with provider context
   */
  protected log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const currentPriority = LOG_LEVEL_PRIORITY[level];
    const minPriority = LOG_LEVEL_PRIORITY[globalLogLevel];

    if (currentPriority < minPriority) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.providerName.toUpperCase()}] [${level.toUpperCase()}]`;

    if (meta) {
      console[level](prefix, message, meta);
    } else {
      console[level](prefix, message);
    }
  }
}
