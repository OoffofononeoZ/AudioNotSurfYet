// Deterministic, self-authored CC0 signals. These test known event timing and
// controlled timbres; they do not establish quality on recordings of musicians.
export interface KnownNote {instrument:'piano'|'guitar';pitch:number;startSeconds:number;endSeconds:number}
export const knownNotes:KnownNote[] = [
    {instrument:'piano',pitch:60,startSeconds:.37,endSeconds:3.05},
    {instrument:'piano',pitch:60,startSeconds:3.31,endSeconds:3.56},
    {instrument:'piano',pitch:64,startSeconds:4.22,endSeconds:4.72},
    {instrument:'guitar',pitch:52,startSeconds:5.11,endSeconds:7.01},
    {instrument:'guitar',pitch:52,startSeconds:7.21,endSeconds:7.56},
    {instrument:'guitar',pitch:55,startSeconds:8.11,endSeconds:8.91},
    {instrument:'piano',pitch:60,startSeconds:9.21,endSeconds:10.31},
    {instrument:'guitar',pitch:64,startSeconds:9.61,endSeconds:11.01},
];
export function instrumentClip():Float32Array<ArrayBuffer> {
    const rate = 44100,pcm = new Float32Array(rate*14);
    for (const note of knownNotes) {
        const frequency = 440*2**((note.pitch-69)/12),first = Math.round(note.startSeconds*rate),end = Math.round(note.endSeconds*rate);
        for (let i=first;i<end;i++) {
            const time = (i-first)/rate,envelope = Math.min(1,time/.003,(end-i)/rate/.015);
            let value = 0;
            for (let harmonic=1;harmonic<=12;harmonic++) {
                const piano = note.instrument === 'piano',amplitude = piano ? 1/harmonic**1.4 : Math.sin(harmonic*Math.PI*.23)/harmonic;
                const decay = piano ? .7+harmonic*.18 : .9+harmonic*.45;
                const inharmonic = piano ? Math.sqrt(1+.00006*harmonic**2) : 1;
                value += amplitude*Math.sin(2*Math.PI*frequency*harmonic*inharmonic*time)*Math.exp(-time*decay);
            }
            pcm[i] += .22*value*envelope;
        }
    }
    // No target instrument: silence and a short noise transient in the last zone.
    let seed = 18319;
    for (let i=12*rate;i<12.06*rate;i++) { seed ^= seed<<13;seed ^= seed>>>17;seed ^= seed<<5;pcm[i] += ((seed>>>0)/2**31-1)*.06*Math.exp(-(i-12*rate)/rate*50); }
    return pcm;
}
export interface KnownDrum {drum:'kick'|'snare'|'hat';startSeconds:number}
export function drumQualityClip():{pcm:Float32Array<ArrayBuffer>;expected:KnownDrum[]} {
    const rate = 24000,pcm = new Float32Array(rate*8),expected:KnownDrum[] = [];
    for (let start=.13;start<7.8;start+=.08) expected.push({drum:'hat',startSeconds:Math.round(start*100)/100});
    for (const start of [.13,.77,2.53,2.61,5.09,5.17,7.33]) expected.push({drum:'kick',startSeconds:start});
    for (const start of [1.41,3.17,6.37]) expected.push({drum:'snare',startSeconds:start});
    let seed = 9987,previous = 0;
    const noise = () => { seed ^= seed<<13;seed ^= seed>>>17;seed ^= seed<<5;return (seed>>>0)/2**31-1; };
    for (const event of expected) {
        const first = Math.round(event.startSeconds*rate),length = Math.min(pcm.length-first,event.drum === 'kick' ? rate*.5 : rate*.15);
        for (let i=0;i<length;i++) {
            const time = i/rate,n = noise(),high = n-previous;previous = n;
            const value = event.drum === 'kick' ? .6*Math.sin(2*Math.PI*(55*time+2*(1-Math.exp(-time*35))))*Math.exp(-time*10)
                : event.drum === 'snare' ? .22*n*Math.exp(-time*24)+.14*Math.sin(2*Math.PI*180*time)*Math.exp(-time*30)
                : .06*high*Math.exp(-time*100);
            pcm[first+i] += value;
        }
    }
    return {pcm,expected};
}
