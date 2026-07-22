# Stability AI Provider

## Overview

The Stability AI provider generates **music and sound effects** via the [Stability AI Platform](https://platform.stability.ai/) using the Stable Audio 2.5 model. It uses native `fetch` (Node 18+) — no additional SDK required.

## Models

| Model ID | Type | Instrumental Only | Max Duration |
|----------|------|-------------------|-------------|
| `stable-audio-2.5` | Music + SFX | Yes | 190s |

## Setup

### Prerequisites

1. A Stability AI account at [platform.stability.ai](https://platform.stability.ai/)
2. An API key (generate under "API Keys")
3. Credits in your account (25 free credits on signup with Google, then $1 per 100 credits)

### Configuration

```typescript
import { StabilityAITTAProvider } from '@loonylabs/tta-middleware';

const provider = new StabilityAITTAProvider({
  apiKey: 'your-api-key',  // Or set STABILITY_AI_API_KEY env var
});
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STABILITY_AI_API_KEY` | Yes | — | Your Stability AI API key |

## Sound Effects

```typescript
const result = await service.generate(
  {
    type: 'sound_effect',
    prompt: 'Thunder crash with echoes fading into the distance',
    durationSeconds: 10,       // 1 - 190 seconds
  },
  TTAProvider.STABILITY_AI
);
```

### Sound Effect Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `durationSeconds` | number | auto | Duration in seconds (max 190) |
| `outputFormat` | string | auto | Output audio format |

## Music

```typescript
const result = await service.generate(
  {
    type: 'music',
    prompt: 'Ambient electronic music, 80 BPM, soft synthesizer pads, warm and atmospheric',
    musicLengthMs: 60000,
    seed: 42,
    negativePrompt: 'vocals, singing, harsh, distorted',
  },
  TTAProvider.STABILITY_AI
);
```

### Music Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `musicLengthMs` | number | auto | Duration in milliseconds (max 190000) |
| `seed` | number | random | Seed for reproducible generation |
| `negativePrompt` | string | — | Elements to avoid in generated music |

### Provider Options

Additional Stability AI-specific parameters can be passed via `providerOptions`:

```typescript
const result = await service.generate(
  {
    type: 'music',
    prompt: 'lo-fi hip hop beat',
    providerOptions: {
      steps: 200,            // Number of denoising steps
      guidance_scale: 7,     // Prompt adherence strength
    },
  },
  TTAProvider.STABILITY_AI
);
```

## Custom Base URL

For testing or self-hosted deployments:

```typescript
const provider = new StabilityAITTAProvider({
  apiKey: 'your-api-key',
  baseUrl: 'https://custom-api.example.com',
});
```

## Limitations

- **Instrumental only** — Cannot generate vocals
- **Max 190 seconds** — Shorter than ElevenLabs and Google Lyria
- **No looping** — Seamless loop generation is not supported
- **Credits-based** — 20 credits per generation (~$0.20)

## Error Handling

```typescript
try {
  await service.generate(request, TTAProvider.STABILITY_AI);
} catch (error) {
  if (error instanceof InvalidConfigError) {
    // API key missing or invalid
  } else if (error instanceof QuotaExceededError) {
    // Rate limited or credits exhausted
  }
}
```

## Pricing

Flat rate of 20 credits per generation. Credits cost $1 USD per 100 credits (~$0.20 per audio).

See [Stability AI Pricing](https://platform.stability.ai/pricing) for current rates.
