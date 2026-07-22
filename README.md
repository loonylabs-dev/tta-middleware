<div align="center">

# @loonylabs/tta-middleware

**Provider-agnostic Text-to-Audio middleware for music and sound effect generation.**

[![npm version](https://img.shields.io/npm/v/@loonylabs/tta-middleware.svg)](https://www.npmjs.com/package/@loonylabs/tta-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)

</div>

---

<details>
<summary><strong>Table of Contents</strong></summary>

- [Features](#features)
- [Quick Start](#quick-start)
- [Providers & Models](#providers--models)
- [API Reference](#api-reference)
- [Advanced Features](#advanced-features)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

</details>

---

## Features

- **Multi-Provider Architecture** — ElevenLabs (SFX + Music), Google Lyria (Instrumental Music), and Stability AI (SFX + Music)
- **Discriminated Union Requests** — Full type safety with separate request types for sound effects and music
- **Retry Logic** — Exponential backoff with jitter for transient errors (429, 5xx, timeouts)
- **Dry Mode** — Validate requests without making API calls (no cost)
- **Debug Logging** — Markdown-based request/response logging
- **TypeScript-First** — Full type definitions with discriminated unions
- **Typed Error Classes** — `InvalidConfigError`, `QuotaExceededError`, `CapabilityNotSupportedError`, etc.
- **Lazy SDK Loading** — Provider SDKs loaded only when needed

## Quick Start

```bash
npm install @loonylabs/tta-middleware

# Install provider SDK(s) you need:
npm install @elevenlabs/elevenlabs-js    # For ElevenLabs
npm install @google-cloud/aiplatform     # For Google Lyria
# Stability AI requires no additional SDK (uses native fetch)
```

```typescript
import { TTAService, ElevenLabsTTAProvider } from '@loonylabs/tta-middleware';

const service = new TTAService();
service.registerProvider(new ElevenLabsTTAProvider({ apiKey: 'your-key' }));

// Generate a sound effect
const sfxResult = await service.generate({
  type: 'sound_effect',
  prompt: 'Thunder crash with echoes',
  durationSeconds: 5,
});

// Generate music
const musicResult = await service.generate({
  type: 'music',
  prompt: 'Smooth jazz piano trio',
  musicLengthMs: 30000,
});

// Access the audio
const audioBase64 = sfxResult.audio[0].data;
const contentType = sfxResult.audio[0].contentType; // 'audio/mpeg'
```

## Providers & Models

| Provider | Model | Type | Looping | Instrumental Only | Max Duration |
|----------|-------|------|---------|-------------------|-------------|
| **ElevenLabs** | `eleven_text_to_sound_v2` | Sound Effects | Yes | No | 30s |
| **ElevenLabs** | `music_v1` | Music | No | No | 600s |
| **Google Lyria** | `lyria-002` | Music | No | Yes | 600s |
| **Stability AI** | `stable-audio-2.5` | Music + SFX | No | Yes | 190s |

## API Reference

### TTAService

```typescript
const service = new TTAService();

// Provider management
service.registerProvider(provider);
service.getProvider(TTAProvider.ELEVENLABS);
service.getAvailableProviders();
service.setDefaultProvider(TTAProvider.GOOGLE_LYRIA);

// Generation
const result = await service.generate(request, provider?);

// Discovery
service.listAllModels();
service.findProvidersWithCapability('soundEffects');
```

### TTARequest (Discriminated Union)

**Sound Effect Request:**
```typescript
interface TTASoundEffectRequest {
  type: 'sound_effect';
  prompt: string;
  durationSeconds?: number;     // 0.5-30
  promptInfluence?: number;     // 0-1
  loop?: boolean;
  model?: string;
  outputFormat?: string;
  retry?: boolean | RetryOptions;
  dry?: boolean;
}
```

**Music Request:**
```typescript
interface TTAMusicRequest {
  type: 'music';
  prompt: string;
  musicLengthMs?: number;       // 3000-600000
  forceInstrumental?: boolean;
  seed?: number;
  negativePrompt?: string;
  model?: string;
  outputFormat?: string;
  retry?: boolean | RetryOptions;
  dry?: boolean;
}
```

### TTAResponse

```typescript
interface TTAResponse {
  audio: TTAAudio[];       // Array of generated audio clips
  metadata: {
    provider: string;
    model: string;
    region?: string;
    duration: number;      // Request duration in ms
  };
  usage: TTAUsage;
  billing?: TTABilling;
}
```

## Advanced Features

### Dry Mode

Test without API calls:

```typescript
const result = await service.generate({
  type: 'sound_effect',
  prompt: 'test',
  dry: true,  // Returns placeholder audio, no API call
});
```

### Retry Configuration

```typescript
const result = await service.generate({
  type: 'music',
  prompt: 'jazz piano',
  retry: {
    maxRetries: 5,
    delayMs: 1000,
    backoffMultiplier: 2.0,
    maxDelayMs: 30000,
    jitter: true,
    timeoutMs: 60000,
  },
});
```

### Debug Logging

```bash
# Enable via environment variable
DEBUG_TTA_REQUESTS=true
```

```typescript
import { TTADebugger } from '@loonylabs/tta-middleware';

TTADebugger.setEnabled(true);
TTADebugger.setLogsDir('./logs/tta/requests');
```

### Error Handling

```typescript
import {
  TTAError,
  InvalidConfigError,
  QuotaExceededError,
  CapabilityNotSupportedError,
} from '@loonylabs/tta-middleware';

try {
  await service.generate(request);
} catch (error) {
  if (error instanceof QuotaExceededError) {
    console.log('Rate limited, try again later');
  } else if (error instanceof CapabilityNotSupportedError) {
    console.log('This provider/model does not support the requested type');
  }
}
```

## Testing

```bash
# Run all unit tests
npm test

# Watch mode
npm run test:unit:watch

# Coverage report
npm run test:unit:coverage

# Manual tests (requires API keys)
npm run test:manual:elevenlabs-sfx
npm run test:manual:elevenlabs-music
npm run test:manual:google-lyria
npm run test:manual:stability-ai-sfx
npm run test:manual:stability-ai-music
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Write tests for your changes
4. Ensure `npm run build && npm test` passes
5. Submit a pull request

## License

MIT - see [LICENSE](LICENSE) for details.
