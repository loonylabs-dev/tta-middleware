/**
 * Manual Test: Stability AI Music
 *
 * Usage: npx ts-node scripts/manual-test-stability-ai-music.ts
 * Requires: STABILITY_AI_API_KEY in .env
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
  const { TTAService } = await import('../src/middleware/services/tta/tta.service');
  const { StabilityAITTAProvider } = await import('../src/middleware/services/tta/providers/stability-ai-provider');
  const { TTAProvider } = await import('../src/middleware/types');

  console.log('=== Stability AI Music Manual Test ===\n');

  const service = new TTAService();
  const provider = new StabilityAITTAProvider();
  service.registerProvider(provider);

  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test: Ambient electronic track
  console.log('Generating ambient electronic track...');
  const result = await service.generate(
    {
      type: 'music',
      prompt: 'Ambient electronic music, slow tempo at 80 BPM, soft synthesizer pads, warm and atmospheric, deep sub-bass, dreamy mood',
      musicLengthMs: 30000,
      negativePrompt: 'vocals, singing, voice, harsh, distorted',
    },
    TTAProvider.STABILITY_AI
  );

  console.log(`  Duration: ${result.metadata.duration}ms`);
  console.log(`  Audio clips: ${result.audio.length}`);
  console.log(`  Content type: ${result.audio[0].contentType}`);

  const buffer = Buffer.from(result.audio[0].data, 'base64');
  const ext = result.audio[0].contentType.includes('wav') ? 'wav' : 'mp3';
  const outputPath = path.join(outputDir, `stability-ai-music-ambient.${ext}`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath}`);

  console.log('\n=== Test completed ===');
}

main().catch(console.error);
