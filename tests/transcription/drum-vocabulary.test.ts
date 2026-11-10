import { describe, expect, it } from 'vitest';
import { ADT_TO_GM, classifyDrumSound, drumSoundKey } from '../../src/transcription/drumVocabulary';

describe('complete ADT custom vocabulary', () => {
    it('keeps the custom hats and cymbals distinct from standard GM numbering', () => {
        expect(classifyDrumSound(43)).toEqual({ gmPitch: 44, category: 'hat' });
        expect(classifyDrumSound(44)).toEqual({ gmPitch: 46, category: 'hat' });
        expect(classifyDrumSound(46)).toEqual({ gmPitch: 49, category: 'crash' });
        expect(classifyDrumSound(48)).toEqual({ gmPitch: 51, category: 'ride' });
    });
    it('retains every published class and preserves the identity of unknown sounds', () => {
        expect(Object.keys(ADT_TO_GM)).toHaveLength(26);
        expect(classifyDrumSound(37).category).toBe('snare');
        expect(classifyDrumSound(39).category).toBe('clap');
        expect(classifyDrumSound(41).category).toBe('tom');
        expect(classifyDrumSound(60).category).toBe('percussion');
        expect(classifyDrumSound(99)).toEqual({ gmPitch: null, category: 'unknown' });
        expect(drumSoundKey('unknown', 98)).not.toBe(drumSoundKey('unknown', 99));
        expect(drumSoundKey('percussion', 50)).not.toBe(drumSoundKey('percussion', 52));
    });
});
