/**
 * Manual Test: Stability AI Sound Effects
 *
 * Usage: npx ts-node scripts/manual-test-stability-ai-sfx.ts
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

  console.log('=== Stability AI Sound Effects Manual Test ===\n');

  const service = new TTAService();
  const provider = new StabilityAITTAProvider();
  service.registerProvider(provider);

  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test 1: Thunder sound effect
  console.log('Test 1: Generating thunder sound effect...');
  const result = await service.generate(
    {
      type: 'sound_effect',
      prompt: 'A deep rumbling thunder crash with echoes fading into the distance',
      durationSeconds: 10,
    },
    TTAProvider.STABILITY_AI
  );

  console.log(`  Duration: ${result.metadata.duration}ms`);
  console.log(`  Audio clips: ${result.audio.length}`);
  console.log(`  Content type: ${result.audio[0].contentType}`);

  const buffer = Buffer.from(result.audio[0].data, 'base64');
  const ext = result.audio[0].contentType.includes('wav') ? 'wav' : 'mp3';
  const outputPath = path.join(outputDir, `stability-ai-sfx-thunder.${ext}`);
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath}`);

  // Test 2: Footsteps
  console.log('\nTest 2: Generating footsteps on gravel...');
  const result2 = await service.generate(
    {
      type: 'sound_effect',
      prompt: 'Footsteps walking on gravel, steady pace, outdoor ambience',
      durationSeconds: 5,
    },
    TTAProvider.STABILITY_AI
  );

  const buffer2 = Buffer.from(result2.audio[0].data, 'base64');
  const ext2 = result2.audio[0].contentType.includes('wav') ? 'wav' : 'mp3';
  const outputPath2 = path.join(outputDir, `stability-ai-sfx-footsteps.${ext2}`);
  fs.writeFileSync(outputPath2, buffer2);
  console.log(`  Saved to: ${outputPath2}`);

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
