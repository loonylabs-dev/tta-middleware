# Getting Started

## Prerequisites

- Node.js 18+
- An ElevenLabs API key and/or a Google Cloud account with Vertex AI enabled

## Installation

```bash
npm install @loonylabs/tta-middleware
```

Install the provider SDK(s) you need:

```bash
# For ElevenLabs (sound effects + music)
npm install @elevenlabs/elevenlabs-js

# For Google Lyria (instrumental music via Vertex AI)
npm install @google-cloud/aiplatform
```

## Configuration

### ElevenLabs

1. Get an API key from [ElevenLabs](https://elevenlabs.io/)
2. Set the environment variable:
   ```bash
   ELEVENLABS_API_KEY=your-api-key
   ```

### Google Lyria

1. Create a Google Cloud project with Vertex AI enabled
2. Create a service account with Vertex AI permissions
3. Set environment variables:
   ```bash
   GOOGLE_CLOUD_PROJECT=your-project-id
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   GOOGLE_CLOUD_REGION=us-central1
   ```

## Quick Start

### Sound Effect Generation

```typescript
import { TTAService, ElevenLabsTTAProvider } from '@loonylabs/tta-middleware';

const service = new TTAService();
service.registerProvider(new ElevenLabsTTAProvider());

const result = await service.generate({
  type: 'sound_effect',
  prompt: 'A deep rumbling thunder crash',
  durationSeconds: 5,
  promptInfluence: 0.7,
});

// result.audio[0].data contains base64-encoded audio
// result.audio[0].contentType is 'audio/mpeg'
```

### Music Generation (ElevenLabs)

```typescript
const result = await service.generate({
  type: 'music',
  prompt: 'Smooth jazz piano trio with upright bass',
  model: 'music_v1',
  musicLengthMs: 30000,
  forceInstrumental: true,
});
```

### Music Generation (Google Lyria)

```typescript
import { TTAService, GoogleLyriaTTAProvider, TTAProvider } from '@loonylabs/tta-middleware';

const service = new TTAService();
service.registerProvider(new GoogleLyriaTTAProvider());

const result = await service.generate(
  {
    type: 'music',
    prompt: 'Cinematic orchestral piece with sweeping strings',
    musicLengthMs: 30000,
  },
  TTAProvider.GOOGLE_LYRIA
);
```

## Provider Comparison

| Feature | ElevenLabs | Google Lyria |
|---------|-----------|--------------|
| Sound Effects | Yes | No |
| Music | Yes | Yes |
| Looping | Yes (SFX) | No |
| Instrumental Only | No | Yes |
| Max Duration | 30s (SFX) / 600s (Music) | 600s |
| Negative Prompt | No | Yes |
| Seed (reproducible) | No | Yes |
