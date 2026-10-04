import type { SeparationResult } from '../../src/processing/kernel';
import { jobDirectory } from '../../src/processing/storage';

// Independent file parser/summary oracle: never calls processing DSP functions.
export async function inspectArtifacts(result:SeparationResult) {
    const directory=await jobDirectory(result.source.directory),reports=[];
    for(const stem of result.stems){
        const [wav,left,right]=await Promise.all([stem.wav,stem.left,stem.right].map(async name=>(await directory.getFileHandle(name)).getFile()));
        const header=new DataView(await wav!.slice(0,44).arrayBuffer());
        const label=(at:number,length:number)=>Array.from({length},(_,i)=>String.fromCharCode(header.getUint8(at+i))).join('');
        if(label(0,4)!=='RIFF'||label(8,4)!=='WAVE'||label(12,4)!=='fmt '||label(36,4)!=='data'
            ||header.getUint32(4,true)!==wav!.size-8||header.getUint32(16,true)!==16||header.getUint16(20,true)!==3
            ||header.getUint16(22,true)!==2||header.getUint32(24,true)!==44100||header.getUint32(28,true)!==352800
            ||header.getUint16(32,true)!==8||header.getUint16(34,true)!==32||header.getUint32(40,true)!==stem.frames*8
            ||wav!.size!==44+stem.frames*8||left!.size!==stem.frames*4||right!.size!==stem.frames*4)throw Error('WAV header/length mismatch');
        let bin=0,count=0,sum=0,min=Infinity,max=-Infinity,peak=0,nonzero=0;
        for(let start=0;start<stem.frames;start+=65536){
            const length=Math.min(65536,stem.frames-start);
            const [wb,lb,rb]=await Promise.all([wav!.slice(44+start*8,44+(start+length)*8),left!.slice(start*4,(start+length)*4),right!.slice(start*4,(start+length)*4)].map(b=>b.arrayBuffer()));
            const view=new DataView(wb!),l=new Float32Array(lb!),r=new Float32Array(rb!);
            for(let i=0;i<length;i++){
                const a=view.getFloat32(i*8,true),b=view.getFloat32(i*8+4,true);
                if(!Number.isFinite(a)||!Number.isFinite(b)||a!==l[i]||b!==r[i])throw Error('WAV/planar sample mismatch');
                sum+=(a*a+b*b)/2;count++;min=Math.min(min,a,b);max=Math.max(max,a,b);peak=Math.max(peak,Math.abs(a),Math.abs(b));if(a!==0||b!==0)nonzero++;
                if(start+i+1===Math.min(stem.frames,(bin+1)*1470)){
                    const db=Math.max(-80,Math.min(0,10*Math.log10(sum/count)));
                    const quantized=Math.round((db+80)/80*65535);
                    if(stem.energy[bin]!==quantized||stem.waveformMin[bin]!==min||stem.waveformMax[bin]!==max)throw Error(`Summary mismatch: ${stem.role} bin ${bin}`);
                    bin++;count=0;sum=0;min=Infinity;max=-Infinity;
                }
            }
        }
        if(bin!==Math.ceil(stem.frames/1470)||stem.energy.length!==bin||stem.waveformMin.length!==bin||stem.waveformMax.length!==bin||stem.energyOffset!==-80||stem.energyScale!==80/65535)throw Error('Summary count/scale mismatch');
        reports.push({role:stem.role,frames:stem.frames,wavBytes:wav!.size,bins:bin,peak,nonzero,samplesIdentical:true,summariesIdentical:true});
    }
    return reports;
}
