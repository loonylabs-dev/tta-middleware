/**
 * Placeholder audio for dry mode responses.
 * A minimal WAV file (1 second of silence, 44100 Hz, 16-bit mono) encoded as base64.
 *
 * WAV header (44 bytes) + 88200 bytes of silence = 88244 bytes total.
 */

// Generate a minimal silent WAV at module load time
function generateSilentWav(): string {
  // WAV parameters
  const sampleRate = 44100;
  const bitsPerSample = 16;
  const numChannels = 1;
  const durationSeconds = 1;

  const dataSize = sampleRate * numChannels * (bitsPerSample / 8) * durationSeconds;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);          // Sub-chunk size
  buffer.writeUInt16LE(1, 20);           // Audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22); // Num channels
  buffer.writeUInt32LE(sampleRate, 24);  // Sample rate
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // Byte rate
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // Block align
  buffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // data sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Data bytes are already 0 (silence) from Buffer.alloc

  return buffer.toString('base64');
}

export const DRY_MODE_PLACEHOLDER_AUDIO = generateSilentWav();

export const DRY_MODE_PLACEHOLDER_CONTENT_TYPE = 'audio/wav';

export const DRY_MODE_PLACEHOLDER_DURATION_MS = 1000;
