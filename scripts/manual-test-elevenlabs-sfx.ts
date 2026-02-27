/**
 * Manual Test: ElevenLabs Sound Effects
 *
 * Usage: npx ts-node scripts/manual-test-elevenlabs-sfx.ts
 * Requires: ELEVENLABS_API_KEY in .env
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
  // Dynamic imports for lazy loading
  const { TTAService } = await import('../src/middleware/services/tta/tta.service');
  const { ElevenLabsTTAProvider } = await import('../src/middleware/services/tta/providers/elevenlabs-provider');

  console.log('=== ElevenLabs Sound Effects Manual Test ===\n');

  // Setup
  const service = new TTAService();
  const provider = new ElevenLabsTTAProvider();
  service.registerProvider(provider);

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test 1: Thunder sound effect
  console.log('Test 1: Generating thunder sound effect...');
  const result = await service.generate({
    type: 'sound_effect',
    prompt: 'A deep rumbling thunder crash with echoes fading into the distance',
    durationSeconds: 5,
    promptInfluence: 0.7,
  });

  console.log(`  Duration: ${result.metadata.duration}ms`);
  console.log(`  Audio clips: ${result.audio.length}`);
  console.log(`  Content type: ${result.audio[0].contentType}`);

  // Save to file
  const buffer = Buffer.from(result.audio[0].data, 'base64');
  const outputPath = path.join(outputDir, 'elevenlabs-sfx-thunder.mp3');
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath}`);

  // Test 2: Short looping sound
  console.log('\nTest 2: Generating short rain loop...');
  const result2 = await service.generate({
    type: 'sound_effect',
    prompt: 'Gentle rain falling on leaves',
    durationSeconds: 3,
    loop: true,
  });

  const buffer2 = Buffer.from(result2.audio[0].data, 'base64');
  const outputPath2 = path.join(outputDir, 'elevenlabs-sfx-rain-loop.mp3');
  fs.writeFileSync(outputPath2, buffer2);
  console.log(`  Saved to: ${outputPath2}`);

  console.log('\n=== All tests completed ===');
}

main().catch(console.error);
