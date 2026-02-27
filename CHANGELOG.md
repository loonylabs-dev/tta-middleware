# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-27

### Added

- Initial release of `@loonylabs/tta-middleware`
- **Provider Architecture**: Multi-provider support with `TTAService` orchestration
- **ElevenLabs Provider**: Sound effect generation (`eleven_text_to_sound_v2`) and music generation (`music_v1`)
- **Google Lyria Provider**: Instrumental music generation via Vertex AI (`lyria-002`)
- **Discriminated Union Requests**: Type-safe `TTASoundEffectRequest` and `TTAMusicRequest` with `type` discriminator
- **Retry Logic**: Exponential backoff with jitter, per-attempt timeout, independent timeout retry budget
- **Dry Mode**: Validate and log requests without API calls (`dry: true`)
- **Debug Logging**: Markdown-based request/response logging via `TTADebugger`
- **Typed Error Classes**: `TTAError`, `InvalidConfigError`, `QuotaExceededError`, `ProviderUnavailableError`, `GenerationFailedError`, `NetworkError`, `CapabilityNotSupportedError`
- **Lazy SDK Loading**: Provider SDKs loaded on first use
- **Capability Discovery**: `findProvidersWithCapability()` for runtime capability queries
- Full TypeScript definitions with discriminated unions
- Comprehensive unit test suite
- Manual test scripts for all providers
- Documentation for getting started and per-provider setup
