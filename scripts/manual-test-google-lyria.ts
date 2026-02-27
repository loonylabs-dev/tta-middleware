/**
 * Manual Test: Google Lyria (Vertex AI)
 *
 * Usage: npx ts-node scripts/manual-test-google-lyria.ts
 * Requires: GOOGLE_CLOUD_PROJECT, GOOGLE_APPLICATION_CREDENTIALS in .env
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

async function main() {
  const { TTAService } = await import('../src/middleware/services/tta/tta.service');
  const { GoogleLyriaTTAProvider } = await import('../src/middleware/services/tta/providers/google-lyria-provider');

  console.log('=== Google Lyria Manual Test ===\n');

  const service = new TTAService();
  const provider = new GoogleLyriaTTAProvider();
  service.registerProvider(provider);

  const outputDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Test: Instrumental music
  console.log('Generating instrumental music via Lyria...');
  const result = await service.generate(
    {
      type: 'music',
      prompt: 'Cinematic orchestral piece with sweeping strings and gentle piano, epic and emotional',
      musicLengthMs: 30000,
    },
    'google-lyria' as any
  );

  console.log(`  Duration: ${result.metadata.duration}ms`);
  console.log(`  Region: ${result.metadata.region}`);
  console.log(`  Audio clips: ${result.audio.length}`);
  console.log(`  Content type: ${result.audio[0].contentType}`);

  const buffer = Buffer.from(result.audio[0].data, 'base64');
  const outputPath = path.join(outputDir, 'google-lyria-orchestral.wav');
  fs.writeFileSync(outputPath, buffer);
  console.log(`  Saved to: ${outputPath}`);

  console.log('\n=== Test completed ===');
}

main().catch(console.error);
