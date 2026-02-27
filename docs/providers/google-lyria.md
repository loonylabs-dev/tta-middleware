# Google Lyria Provider

## Overview

The Google Lyria provider generates **instrumental music** via [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai). It uses the Lyria model family.

**Important:** Google Lyria only supports **music** generation. Sound effect requests will throw a `CapabilityNotSupportedError`.

## Models

| Model ID | Type | Instrumental Only | Max Duration |
|----------|------|-------------------|-------------|
| `lyria-002` | Music | Yes | 600s |

## Setup

### Prerequisites

1. A Google Cloud project with Vertex AI API enabled
2. A service account with `Vertex AI User` role
3. The `@google-cloud/aiplatform` SDK installed

```bash
npm install @google-cloud/aiplatform
```

### Configuration

```typescript
import { GoogleLyriaTTAProvider } from '@loonylabs/tta-middleware';

const provider = new GoogleLyriaTTAProvider({
  projectId: 'your-project-id',
  region: 'us-central1',
  keyFilename: './service-account.json',
});
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLOUD_PROJECT` | Yes | — | Google Cloud project ID |
| `GOOGLE_CLOUD_REGION` | No | `us-central1` | Vertex AI region |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes | — | Path to service account JSON |

## Usage

```typescript
const result = await service.generate(
  {
    type: 'music',
    prompt: 'Cinematic orchestral piece with sweeping strings and gentle piano',
    musicLengthMs: 30000,
    seed: 42,                    // For reproducible output
    negativePrompt: 'drums',    // Avoid certain elements
  },
  TTAProvider.GOOGLE_LYRIA
);
```

### Music Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `musicLengthMs` | number | auto | Duration in milliseconds (3000-600000) |
| `seed` | number | random | Seed for reproducible generation |
| `negativePrompt` | string | — | Elements to avoid in generated music |

### Provider Options

```typescript
// Request multiple samples
const result = await service.generate({
  type: 'music',
  prompt: 'ambient electronic',
  providerOptions: {
    sampleCount: 4,  // Generate up to 4 variations
  },
});

// result.audio will contain multiple clips
```

## Limitations

- **Music only** — Sound effects are not supported
- **Instrumental only** — Cannot generate vocals
- **Region availability** — Currently available in `us-central1`

## Error Handling

```typescript
try {
  // This will throw CapabilityNotSupportedError
  await service.generate(
    { type: 'sound_effect', prompt: 'explosion' },
    TTAProvider.GOOGLE_LYRIA
  );
} catch (error) {
  if (error instanceof CapabilityNotSupportedError) {
    console.log('Lyria does not support sound effects');
  }
}
```

## Pricing

See [Vertex AI Pricing](https://cloud.google.com/vertex-ai/pricing) for current rates.
