/**
 * Manual Test: ElevenLabs Music
 *
 * Usage: npx ts-node scripts/manual-test-elevenlabs-music.ts
 * Requires: ELEVENLABS_API_KEY in .env
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
  const { TTAService } = await import('../src/middleware/services/tta/tta.service');
  const { ElevenLabsTTAProvider } = await import('../src/middleware/services/tta/providers/elevenlabs-provider');

  console.log('=== ElevenLabs Music Manual Test ===\n');

  const service = new TTAService();
  const provider = new ElevenLabsTTAProvider();
  service.registerProvider(provider);

  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test: Jazz piano track
  console.log('Generating jazz piano track...');
  const result = await service.generate({
    type: 'music',
    prompt: 'Smooth jazz piano trio with upright bass and brushed drums, relaxed late-night club atmosphere',
    model: 'music_v1',
    musicLengthMs: 30000,
    forceInstrumental: true,
  });

  console.log(`  Duration: ${result.metadata.duration}ms`);
  console.log(`  Audio clips: ${result.audio.length}`);
  console.log(`  Content type: ${result.audio[0].contentType}`);

  const buffer = Buffer.from(result.audio[0].data, 'base64');
  const outputPath = path.join(outputDir, 'elevenlabs-music-jazz-piano.mp3');
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath}`);

  console.log('\n=== Test completed ===');
}

main().catch(console.error);
