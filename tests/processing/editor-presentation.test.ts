import { expect,it } from 'vitest';
import type { StemArtifact } from '../../src/processing/kernel';
import { stemPaths,currentModelRole } from '../../src/processing/presentation';

function stem(min:number[],max:number[],energy:number[]):StemArtifact {
    return {waveformMin:new Float32Array(min),waveformMax:new Float32Array(max),energy:new Uint16Array(energy)} as StemArtifact;
}
it('keeps an isolated peak when reducing waveform bins and preserves energy endpoints',()=>{
    const plot=stemPaths(stem([0,-.25,0,-1],[0,.5,0,1],[0,0,65535,65535]),2);
    expect(plot.peak).toBe(1);expect(plot.waveform).toContain('2.00,5.00');expect(plot.waveform).toContain('2.00,75.00');
    expect(plot.energy).toBe('M0,24 L0.00,24.00 L2.00,2.00 L2,24 Z');
});
it('renders silence without NaN and handles empty and single-bin data',()=>{
    expect(stemPaths(stem([],[],[]))).toEqual({waveform:'',energy:'',peak:0});
    const silent=stemPaths(stem([0],[0],[0]));expect(silent.peak).toBe(0);expect(silent.waveform).toContain('0.00,40.00');
    expect(silent.waveform+silent.energy).not.toMatch(/NaN|Infinity/);
});
it('labels the next specialist while downloading or checking it and the loaded role during inference',()=>{
    expect(currentModelRole('model-download',null)).toBe('drums');expect(currentModelRole('model-verify',null)).toBe('drums');
    expect(currentModelRole('inference','drums')).toBe('drums');expect(currentModelRole('model-download','drums')).toBe('bass');
    expect(currentModelRole('model-verify','bass')).toBe('other');expect(currentModelRole('model-load','other')).toBe('other');
    expect(currentModelRole('model-verify','other')).toBe('vocals');expect(currentModelRole('persist','vocals')).toBe('vocals');
});
it('does not mislabel global PCM preparation or all-file result validation as a specialist',()=>{
    expect(currentModelRole('pcm-staging',null)).toBeNull();expect(currentModelRole('model-resample',null)).toBeNull();
    expect(currentModelRole('result-verify','vocals')).toBeNull();expect(currentModelRole('model-download','vocals')).toBeNull();
});
