import { hashBytes } from '../processing/sha256';
import { TRANSCRIPTION_CONFIG } from './modelManifest';
import { DRUM_RUNTIME_CONFIG } from './drumRuntime';
import { DRUM_WINDOW_CONFIG } from './drumWindows';
import type { DrumBackend } from './drumRuntime';

export function drumConfigurationHash(backend: DrumBackend): string {
    return hashBytes(
        new TextEncoder().encode(
            JSON.stringify({
                version: 2,
                frontend: TRANSCRIPTION_CONFIG.drums,
                backend,
                runtime: DRUM_RUNTIME_CONFIG,
                windows: DRUM_WINDOW_CONFIG,
            }),
        ),
    );
}
