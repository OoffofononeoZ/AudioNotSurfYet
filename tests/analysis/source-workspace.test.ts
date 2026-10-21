import { describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { validateSourceWorkspace, cloneSourceWorkspace } from '../../src/analysis/sourceWorkspace';
import { validatePersistedSessionV1 } from '../../src/persistence/sessionRepository';
import { DEFAULT_PERSISTED_ANALYSIS_CONFIG } from '../../src/types/session';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import {
    createInitialEditorProject,
    encodeEditorProjectV2,
    decodeEditorProject,
    validateEditorProjectV2,
} from '../../src/editor/projectCodec';

describe('persisted source references', () => {
    it('round-trips independent queues without cloning reactive proxies', () => {
        setActivePinia(createPinia());
        const sources = {
            selected: 'drums' as const,
            queues: { drums: ['energy' as const], bass: ['buffer' as const] },
        };
        const session = validatePersistedSessionV1({
            schemaVersion: 1,
            analyzerWorkspaceVersion: 2,
            savedAt: '2026-10-22',
            queue: [],
            currentTrackId: null,
            handles: [],
            activeCards: [],
            viewport: null,
            analysisConfig: DEFAULT_PERSISTED_ANALYSIS_CONFIG,
            analysisSources: sources,
        });
        expect(session.analysisSources).toEqual(sources);
        const store = useAudioSessionStore();
        store.setAnalysisWorkspace({ initialized: true, activeFeatureQueue: [], viewport: null, sources });
        expect(cloneSourceWorkspace(store.analysisWorkspace.sources)).toEqual(sources);
        expect(() => validateSourceWorkspace({ selected: 'drums', queues: { drums: ['mfcc'] } })).toThrow();
        expect(() => validateSourceWorkspace({ selected: 'drums', queues: { drums: ['energy', 'energy'] } })).toThrow();
    });
    it('saves an Editor stem selection while preserving original projects and rejecting invalid pairs', () => {
        const project = createInitialEditorProject({
            track: { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 12, sampleRate: 48000 },
        });
        expect(decodeEditorProject(encodeEditorProjectV2(project))).toEqual(project);
        project.workspace.overlay = { ...project.workspace.overlay, featureId: 'energy', stemRole: 'vocals' };
        expect(decodeEditorProject(encodeEditorProjectV2(project)).workspace.overlay).toEqual(
            project.workspace.overlay,
        );
        expect(() =>
            validateEditorProjectV2({
                ...project,
                workspace: { ...project.workspace, overlay: { ...project.workspace.overlay, featureId: 'mfcc' } },
            }),
        ).toThrow();
    });
});
