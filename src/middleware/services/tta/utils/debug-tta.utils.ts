/**
 * TTA Debugger Utility
 *
 * Provides markdown-based logging for TTA requests, similar to TTI middleware.
 * Logs prompts, generation type, duration, and responses.
 *
 * Enable via:
 * - Environment variable: DEBUG_TTA_REQUESTS=true
 * - Or programmatically: TTADebugger.setEnabled(true)
 *
 * Configure log directory:
 * - Environment variable: TTA_DEBUG_LOG_DIR=/path/to/logs
 * - Or programmatically: TTADebugger.setLogsDir('/path/to/logs')
 * - Default: process.cwd()/logs/tta/requests/
 */

import * as fs from 'fs';
import * as path from 'path';
import { TTARequest, TTAResponse } from '../../../types';

// ============================================================
// TYPES
// ============================================================

/**
 * Debug information for a TTA request
 */
export interface TTADebugInfo {
  // Request metadata
  requestTimestamp: Date;
  responseTimestamp?: Date;

  // Provider info
  provider: string;
  model: string;
  region?: string;

  // Request data
  prompt: string;
  generationType: 'sound_effect' | 'music';
  durationSeconds?: number;
  musicLengthMs?: number;
  outputFormat?: string;
  providerOptions?: Record<string, unknown>;

  // Response data (populated after generation)
  response?: {
    audioCount: number;
    audioContentTypes: string[];
    duration: number;
  };

  // Raw data for debugging
  rawRequest?: TTARequest;
  rawResponse?: TTAResponse;

  // Error (if any)
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Configuration options for TTADebugger
 */
export interface TTADebuggerConfig {
  /** Enable/disable logging (default: from DEBUG_TTA_REQUESTS env) */
  enabled?: boolean;
  /** Directory for log files (default: process.cwd()/logs/tta/requests) */
  logsDir?: string;
  /** Include raw base64 audio data in logs (default: false - too large) */
  includeBase64?: boolean;
  /** Log to console as well (default: false) */
  consoleLog?: boolean;
}

// ============================================================
// DEBUGGER CLASS
// ============================================================

/**
 * Static debugger class for TTA request/response logging
 */
export class TTADebugger {
  private static _enabled: boolean =
    process.env.DEBUG_TTA_REQUESTS === 'true' ||
    process.env.NODE_ENV === 'development';

  private static _logsDir: string =
    process.env.TTA_DEBUG_LOG_DIR ||
    path.join(process.cwd(), 'logs', 'tta', 'requests');

  private static _includeBase64: boolean = false;
  private static _consoleLog: boolean = false;

  // ============================================================
  // CONFIGURATION
  // ============================================================

  static get isEnabled(): boolean {
    return this._enabled;
  }

  static setEnabled(enabled: boolean): void {
    this._enabled = enabled;
  }

  static getLogsDir(): string {
    return this._logsDir;
  }

  static setLogsDir(dir: string): void {
    this._logsDir = dir;
  }

  static configure(config: TTADebuggerConfig): void {
    if (config.enabled !== undefined) {
      this._enabled = config.enabled;
    }
    if (config.logsDir !== undefined) {
      this._logsDir = config.logsDir;
    }
    if (config.includeBase64 !== undefined) {
      this._includeBase64 = config.includeBase64;
    }
    if (config.consoleLog !== undefined) {
      this._consoleLog = config.consoleLog;
    }
  }

  // ============================================================
  // LOGGING METHODS
  // ============================================================

  static async logRequest(debugInfo: TTADebugInfo): Promise<void> {
    if (!this._enabled) return;

    if (this._consoleLog) {
      console.log('[TTA Debug] Request:', {
        provider: debugInfo.provider,
        model: debugInfo.model,
        generationType: debugInfo.generationType,
        prompt: debugInfo.prompt.substring(0, 100) + '...',
      });
    }
  }

  static async logResponse(debugInfo: TTADebugInfo): Promise<void> {
    if (!this._enabled) return;

    try {
      await this.saveToMarkdown(debugInfo);

      if (this._consoleLog) {
        console.log('[TTA Debug] Response saved:', {
          provider: debugInfo.provider,
          model: debugInfo.model,
          duration: debugInfo.response?.duration,
          audioCount: debugInfo.response?.audioCount,
        });
      }
    } catch (error) {
      console.error('[TTA Debug] Failed to save log:', error);
    }
  }

  static async logError(debugInfo: TTADebugInfo): Promise<void> {
    if (!this._enabled) return;

    try {
      await this.saveToMarkdown(debugInfo);

      if (this._consoleLog) {
        console.error('[TTA Debug] Error:', debugInfo.error);
      }
    } catch (error) {
      console.error('[TTA Debug] Failed to save error log:', error);
    }
  }

  // ============================================================
  // MARKDOWN GENERATION
  // ============================================================

  static async saveToMarkdown(debugInfo: TTADebugInfo): Promise<string> {
    this.ensureLogsDirectory();

    const filename = this.generateFilename(debugInfo);
    const filepath = path.join(this._logsDir, filename);
    const content = this.formatMarkdown(debugInfo);

    await fs.promises.writeFile(filepath, content, 'utf-8');

    return filepath;
  }

  private static generateFilename(debugInfo: TTADebugInfo): string {
    const timestamp = debugInfo.requestTimestamp
      .toISOString()
      .replace(/[:.]/g, '-');

    const typePart = `_${debugInfo.generationType}`;

    return `${timestamp}${typePart}.md`;
  }

  private static formatMarkdown(debugInfo: TTADebugInfo): string {
    const sections: string[] = [];

    // Header
    sections.push('# TTA Request & Response Log\n');

    // Provider Information
    sections.push('## Provider Information\n');
    sections.push(`- **Provider**: ${debugInfo.provider}`);
    sections.push(`- **Model**: ${debugInfo.model}`);
    if (debugInfo.region) {
      sections.push(`- **Region**: ${debugInfo.region}`);
    }
    sections.push('');

    // Request Information
    sections.push('## Request Information\n');
    sections.push(
      `- **Request Timestamp**: ${debugInfo.requestTimestamp.toISOString()}`
    );
    if (debugInfo.responseTimestamp) {
      sections.push(
        `- **Response Timestamp**: ${debugInfo.responseTimestamp.toISOString()}`
      );
    }
    sections.push(`- **Generation Type**: ${debugInfo.generationType}`);
    if (debugInfo.durationSeconds !== undefined) {
      sections.push(`- **Duration (seconds)**: ${debugInfo.durationSeconds}`);
    }
    if (debugInfo.musicLengthMs !== undefined) {
      sections.push(`- **Music Length (ms)**: ${debugInfo.musicLengthMs}`);
    }
    if (debugInfo.outputFormat) {
      sections.push(`- **Output Format**: ${debugInfo.outputFormat}`);
    }
    sections.push('');

    // Prompt
    sections.push('## Prompt\n');
    sections.push('```');
    sections.push(debugInfo.prompt);
    sections.push('```');
    sections.push('');

    // Provider Options
    if (
      debugInfo.providerOptions &&
      Object.keys(debugInfo.providerOptions).length > 0
    ) {
      sections.push('## Provider Options\n');
      sections.push('```json');
      sections.push(JSON.stringify(debugInfo.providerOptions, null, 2));
      sections.push('```');
      sections.push('');
    }

    // Response
    if (debugInfo.response) {
      sections.push('## Response\n');
      sections.push(`- **Audio Count**: ${debugInfo.response.audioCount}`);
      sections.push(
        `- **Content Types**: ${debugInfo.response.audioContentTypes.join(', ')}`
      );
      sections.push(`- **Duration**: ${debugInfo.response.duration}ms`);
      sections.push('');
    }

    // Raw Request Data (without base64)
    if (debugInfo.rawRequest) {
      sections.push('## Raw Request Data\n');
      sections.push('```json');
      sections.push(JSON.stringify(debugInfo.rawRequest, null, 2));
      sections.push('```');
      sections.push('');
    }

    // Raw Response Data (without base64)
    if (debugInfo.rawResponse) {
      sections.push('## Raw Response Data\n');
      sections.push('```json');
      const sanitizedResponse = this.sanitizeResponse(debugInfo.rawResponse);
      sections.push(JSON.stringify(sanitizedResponse, null, 2));
      sections.push('```');
      sections.push('');
    }

    // Error
    if (debugInfo.error) {
      sections.push('## Error\n');
      sections.push(`- **Message**: ${debugInfo.error.message}`);
      if (debugInfo.error.code) {
        sections.push(`- **Code**: ${debugInfo.error.code}`);
      }
      if (debugInfo.error.details) {
        sections.push('- **Details**:');
        sections.push('```json');
        sections.push(JSON.stringify(debugInfo.error.details, null, 2));
        sections.push('```');
      }
      sections.push('');
    }

    // Footer
    sections.push('---');
    sections.push(`*Generated on ${new Date().toISOString()}*`);

    return sections.join('\n');
  }

  private static sanitizeResponse(
    response: TTAResponse
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = { ...response };

    if (response.audio && !this._includeBase64) {
      sanitized.audio = response.audio.map((clip, index) => ({
        index,
        contentType: clip.contentType || 'unknown',
        durationMs: clip.durationMs,
        dataLength: clip.data?.length || 0,
        dataPreview: clip.data ? `${clip.data.substring(0, 50)}...` : null,
      }));
    }

    return sanitized;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private static ensureLogsDirectory(): void {
    if (!fs.existsSync(this._logsDir)) {
      fs.mkdirSync(this._logsDir, { recursive: true });
    }
  }

  static createDebugInfo(
    request: TTARequest,
    provider: string,
    model: string,
    options?: {
      region?: string;
    }
  ): TTADebugInfo {
    return {
      requestTimestamp: new Date(),
      provider,
      model,
      region: options?.region,
      prompt: request.prompt,
      generationType: request.type,
      durationSeconds: request.type === 'sound_effect' ? request.durationSeconds : undefined,
      musicLengthMs: request.type === 'music' ? request.musicLengthMs : undefined,
      outputFormat: request.outputFormat,
      providerOptions: request.providerOptions,
      rawRequest: request,
    };
  }

  static updateWithResponse(
    debugInfo: TTADebugInfo,
    response: TTAResponse
  ): TTADebugInfo {
    return {
      ...debugInfo,
      responseTimestamp: new Date(),
      response: {
        audioCount: response.audio.length,
        audioContentTypes: response.audio.map(
          (clip) => clip.contentType || 'unknown'
        ),
        duration: response.metadata.duration,
      },
      rawResponse: response,
    };
  }

  static updateWithError(
    debugInfo: TTADebugInfo,
    error: Error & { code?: string; cause?: unknown }
  ): TTADebugInfo {
    return {
      ...debugInfo,
      responseTimestamp: new Date(),
      error: {
        message: error.message,
        code: error.code,
        details: error.cause,
      },
    };
  }
}

export default TTADebugger;
