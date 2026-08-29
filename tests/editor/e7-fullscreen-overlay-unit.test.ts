import { describe, expect, test } from 'vitest';
import {
    editorOverlayFeatureIds,
    resolveEditorOverlayOpen,
} from '../../src/editor/overlay';

describe('Editor E7 fullscreen overlay state', () => {
    test('resolves legacy drafts and new projects without changing JSON V1', () => {
        expect(resolveEditorOverlayOpen('rms', null)).toBe(true);
        expect(resolveEditorOverlayOpen('rms', false)).toBe(false);
        expect(resolveEditorOverlayOpen('rms', true)).toBe(true);
        expect(resolveEditorOverlayOpen(null, null)).toBe(false);
        expect(resolveEditorOverlayOpen(null, true)).toBe(false);
    });

    test('keeps Buffer as the only active analysis feature while closed', () => {
        expect(editorOverlayFeatureIds('rms', false)).toEqual(['buffer']);
        expect(editorOverlayFeatureIds('buffer', false)).toEqual(['buffer']);
        expect(editorOverlayFeatureIds('rms', true)).toEqual(['buffer', 'rms']);
        expect(editorOverlayFeatureIds('buffer', true)).toEqual(['buffer']);
    });
});
