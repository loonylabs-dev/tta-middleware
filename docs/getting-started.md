# Getting Started

## Prerequisites

- Node.js 18+
- An API key for at least one provider: ElevenLabs, Google Cloud (Vertex AI), or Stability AI

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

# For Stability AI (music + SFX) — no additional SDK needed
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

### Stability AI

1. Create an account at [platform.stability.ai](https://platform.stability.ai/)
2. Generate an API key under "API Keys"
3. Set the environment variable:
   ```bash
   STABILITY_AI_API_KEY=your-api-key
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

### Music + SFX Generation (Stability AI)

```typescript
import { TTAService, StabilityAITTAProvider, TTAProvider } from '@loonylabs/tta-middleware';

const service = new TTAService();
service.registerProvider(new StabilityAITTAProvider());

// Sound effect
const sfx = await service.generate(
  {
    type: 'sound_effect',
    prompt: 'Thunder crash with echoes',
    durationSeconds: 10,
  },
  TTAProvider.STABILITY_AI
);

// Music
const music = await service.generate(
  {
    type: 'music',
    prompt: 'Ambient electronic, 80 BPM, soft synth pads',
    musicLengthMs: 30000,
    negativePrompt: 'vocals, singing',
  },
  TTAProvider.STABILITY_AI
);
```

## Provider Comparison

| Feature | ElevenLabs | Google Lyria | Stability AI |
|---------|-----------|--------------|--------------|
| Sound Effects | Yes | No | Yes |
| Music | Yes | Yes | Yes |
| Looping | Yes (SFX) | No | No |
| Instrumental Only | No | Yes | Yes |
| Max Duration | 30s (SFX) / 600s (Music) | 600s | 190s |
| Negative Prompt | No | Yes | Yes |
| Seed (reproducible) | No | Yes | Yes |
| Additional SDK | `@elevenlabs/elevenlabs-js` | `@google-cloud/aiplatform` | None (native fetch) |
