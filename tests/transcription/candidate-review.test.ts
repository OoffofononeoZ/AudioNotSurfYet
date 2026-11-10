import { expect, it } from 'vitest';
import { deriveCandidateReview } from '../../src/transcription/candidateReview';
import { defaultReviewSettings } from '../../src/transcription/reviewSettings';
import { applySoundMarkers } from '../../src/transcription/applySoundMarkers';
import { applyCandidateResult } from '../../src/transcription/applyCandidates';
import { createInitialEditorProject, encodeEditorProjectV2, decodeEditorProject } from '../../src/editor/projectCodec';
import { drumCandidate, noteCandidate, reviewResult } from './review-fixture';

it('recomputes conservative versus sensitive review without changing raw model events', () => {
    const weak = noteCandidate('weak', 1, 1.2);
    weak.strength = 0.2;
    const result = reviewResult([weak, noteCandidate('strong', 2, 2.5)]),
        before = JSON.stringify(result);
    const settings = defaultReviewSettings();
    expect(deriveCandidateReview(result, settings, {}).selectedIds).toEqual(['strong']);
    settings.sensitivity = 'sensitive';
    expect(deriveCandidateReview(result, settings, {}).selectedIds).toEqual(['weak', 'strong']);
    expect(JSON.stringify(result)).toBe(before);
});
it('groups a chord into one timbre range and splits a repeated independent attack', () => {
    const result = reviewResult([
        noteCandidate('a', 1, 2, 'piano', 60),
        noteCandidate('b', 1, 2, 'piano', 64),
        noteCandidate('c', 1.6, 1.8, 'piano', 60),
    ]);
    const preview = deriveCandidateReview(result, defaultReviewSettings(), {});
    expect(preview.markers.map(marker => [marker.startSeconds, marker.endSeconds, marker.eventKind])).toEqual([
        [1, 1.6, 'range'],
        [1.6, 2, 'range'],
    ]);
    expect(new Set(preview.markers.map(marker => marker.groupId)).size).toBe(1);
});
it('keeps offset chord notes on the same acoustic attack together', () => {
    const a = noteCandidate('a', 1, 2),
        b = noteCandidate('b', 1.04, 2, 'piano', 64);
    a.acoustics!.onsetSeconds = 1.02;
    b.acoustics!.onsetSeconds = 1.02;
    const preview = deriveCandidateReview(reviewResult([a, b]), defaultReviewSettings(), {});
    expect(preview.markers.map(marker => [marker.startSeconds, marker.endSeconds])).toEqual([[1, 2]]);
});
it('preserves fast independent rolls and distinct simultaneous custom sounds', () => {
    const result = reviewResult([
        drumCandidate('a', 1),
        drumCandidate('b', 1.02),
        drumCandidate('c', 1, 41),
        drumCandidate('d', 1, 47),
    ]);
    const preview = deriveCandidateReview(result, defaultReviewSettings(), {});
    expect(preview.markers).toHaveLength(4);
    expect(preview.groups).toHaveLength(3);
});
it('coalesces only an explicitly shared sound group at the same acoustic point and retains raw identities', () => {
    const a = drumCandidate('a', 1, 41),
        b = drumCandidate('b', 1, 47),
        result = reviewResult([a, b]);
    const settings = defaultReviewSettings();
    expect(deriveCandidateReview(result, settings, {}).markers).toHaveLength(2);
    settings.groups['drum:41'] = { label: '同类通鼓', instrument: 'drums' };
    settings.assignments.b = 'drum:41';
    const review = deriveCandidateReview(result, settings, {});
    expect(review.markers).toHaveLength(1);
    expect(review.markers[0]!.rawIds).toEqual(['a', 'b']);
    expect(result.candidates).toHaveLength(2);
    const project = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 30, sampleRate: 44100 },
        createId: () => crypto.randomUUID(),
    });
    expect(applySoundMarkers(project, result, review).lanes.at(-1)!.events).toHaveLength(1);
});
it('folds likely source leakage using acoustic evidence and permits retaining a real ensemble', () => {
    const a = noteCandidate('piano', 1, 2),
        b = noteCandidate('guitar', 1.01, 2, 'guitar');
    a.acoustics!.rms = 0.8;
    b.acoustics!.rms = 0.2;
    const result = reviewResult([a, b]),
        settings = defaultReviewSettings(),
        review = deriveCandidateReview(result, settings, {});
    expect(review.duplicateGroups[0]!.recommendedId).toBe(a.id);
    expect(review.selectedIds).toEqual([a.id]);
    settings.duplicateSelections[review.duplicateGroups[0]!.id] = [a.id, b.id];
    expect(deriveCandidateReview(result, settings, {}).selectedIds).toEqual([a.id, b.id]);
    a.acoustics!.rms = 0.38;
    expect(deriveCandidateReview(result, defaultReviewSettings(), {}).selectedIds).toEqual([]);
    b.pitch = 65;
    expect(deriveCandidateReview(result, defaultReviewSettings(), {}).duplicateGroups).toEqual([]);
});
it('does not discard a near-time repeated attack and folds only a matching weak trailing observation', () => {
    const a = noteCandidate('a', 1, 1.5),
        b = noteCandidate('b', 1.04, 1.5);
    const result = reviewResult([a, b]),
        settings = defaultReviewSettings();
    expect(deriveCandidateReview(result, settings, {}).selectedIds).toHaveLength(2);
    b.acoustics!.onset = 0;
    b.acoustics!.onsetSeconds = 1;
    expect(deriveCandidateReview(result, settings, {}).selectedIds).toEqual(['a']);
});
it('applies sound groups atomically in V2, preserves manual data, and cannot reapply by changing view', () => {
    let id = 0;
    const project = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 30, sampleRate: 44100 },
        createId: () => `id-${id++}`,
    });
    const result = reviewResult([noteCandidate('a', 1, 2), noteCandidate('b', 1, 2, 'piano', 64)]),
        before = structuredClone(project);
    const review = deriveCandidateReview(result, defaultReviewSettings(), {});
    const applied = applySoundMarkers(project, result, review);
    expect(applied.lanes).toHaveLength(project.lanes.length + 1);
    expect(applied.lanes.at(-1)!.innerClasses).toHaveLength(1);
    expect(applied.tempoMap).toEqual(project.tempoMap);
    expect(project).toEqual(before);
    expect(decodeEditorProject(encodeEditorProjectV2(applied))).toEqual(applied);
    expect(() => applyCandidateResult(applied, result, {})).toThrow(/已经应用/);
    review.markers[0]!.rawIds = ['foreign'];
    expect(() => applySoundMarkers(project, result, review)).toThrow();
    expect(project).toEqual(before);
});
