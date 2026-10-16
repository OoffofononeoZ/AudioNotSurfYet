import {expect,test} from 'vitest';
import { FEATURE_IDS } from '../../src/analysis/types';
import { analyzerData } from '../../src/data/analyzerData';
test('definition order is the only Analyzer list order',()=>{
    expect(FEATURE_IDS[0]).toBe('wallpaperEngineSpectrum');
    expect(analyzerData.map(entry=>entry.abbreviation)).toEqual([...FEATURE_IDS]);
});
