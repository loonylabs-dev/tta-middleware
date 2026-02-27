# ElevenLabs Provider

## Overview

The ElevenLabs provider supports both **sound effect** and **music** generation via the [ElevenLabs API](https://elevenlabs.io/).

## Models

| Model ID | Type | Looping | Max Duration |
|----------|------|---------|-------------|
| `eleven_text_to_sound_v2` | Sound Effects | Yes | 30s |
| `music_v1` | Music | No | 600s |

## Configuration

### Constructor Options

```typescript
import { ElevenLabsTTAProvider } from '@loonylabs/tta-middleware';

const provider = new ElevenLabsTTAProvider({
  apiKey: 'your-api-key',  // Or set ELEVENLABS_API_KEY env var
});
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ELEVENLABS_API_KEY` | Yes | Your ElevenLabs API key |

## Sound Effects

```typescript
const result = await service.generate({
  type: 'sound_effect',
  prompt: 'Thunder crash with echoes fading into the distance',
  durationSeconds: 5,       // 0.5 - 30 seconds
  promptInfluence: 0.7,     // 0 (more random) to 1 (strict prompt following)
  loop: false,              // Generate seamless loop
});
```

### Sound Effect Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `durationSeconds` | number | auto | Duration in seconds (0.5-30) |
| `promptInfluence` | number | auto | How closely to follow the prompt (0-1) |
| `loop` | boolean | false | Generate a seamlessly looping sound |

## Music

```typescript
const result = await service.generate({
  type: 'music',
  prompt: 'Smooth jazz piano trio with upright bass and brushed drums',
  model: 'music_v1',
  musicLengthMs: 30000,        // 30 seconds
  forceInstrumental: true,     // No vocals
});
```

### Music Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `musicLengthMs` | number | auto | Duration in milliseconds (3000-600000) |
| `forceInstrumental` | boolean | false | Force instrumental-only output |

## Error Handling

```typescript
try {
  await service.generate(request);
} catch (error) {
  if (error instanceof InvalidConfigError) {
    // API key missing or invalid
  } else if (error instanceof QuotaExceededError) {
    // Rate limited - try again later
  }
}
```

## Pricing

See [ElevenLabs Pricing](https://elevenlabs.io/pricing) for current rates.
