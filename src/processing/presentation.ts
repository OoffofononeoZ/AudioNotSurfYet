import type { StemArtifact } from './kernel';
import { FT_ROLES,type StemRole } from './modelManifest';
export function currentModelRole(phase:string|undefined,lastLoaded:StemRole|null):StemRole|null {
    if(phase==='model-download'||phase==='model-verify')return FT_ROLES[lastLoaded?FT_ROLES.indexOf(lastLoaded)+1:0]??null;
    return phase&&['model-load','inference','stitch','derive','persist'].includes(phase)?lastLoaded:null;
}
export const STEM_PRESENTATION={
    drums:{label:'鼓与打击乐',color:'#efa96b',short:'DR'},
    bass:{label:'低音',color:'#7eaddc',short:'BS'},
    other:{label:'其余伴奏',color:'#b49dde',short:'OT'},
    vocals:{label:'人声',color:'#87d7ba',short:'VO'},
} as const;
export const PHASE_LABELS:Record<string,string>={
    'pcm-staging':'准备原始音频','model-resample':'准备模型输入','model-download':'下载模型','model-verify':'校验模型',
    'model-load':'加载模型','inference':'分段推断','stitch':'拼接音轨','derive':'生成波形与能量','persist':'写入音轨','result-verify':'校验并保存完整结果',
};
export function formatBytes(bytes:number):string{return bytes>=1024**3?`${(bytes/1024**3).toFixed(2)} GiB`:`${(bytes/1024**2).toFixed(1)} MiB`;}
export function clockTime(seconds:number):string{const n=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));return `${Math.floor(n/60)}:${(n%60).toString().padStart(2,'0')}`;}
export function stemPaths(stem:StemArtifact,width=800):{waveform:string;energy:string;peak:number}{
    const count=stem.energy.length;if(!count)return {waveform:'',energy:'',peak:0};
    let peak=0;for(let i=0;i<count;i++)peak=Math.max(peak,Math.abs(stem.waveformMin[i]!),Math.abs(stem.waveformMax[i]!));
    const columns=Math.min(width,count),upper:string[]=[],lower:string[]=[],energy:string[]=[];
    for(let column=0;column<columns;column++){
        const from=Math.floor(column*count/columns),to=Math.max(from+1,Math.floor((column+1)*count/columns));
        let min=0,max=0,power=0;
        for(let i=from;i<to;i++){min=Math.min(min,stem.waveformMin[i]!);max=Math.max(max,stem.waveformMax[i]!);power+=stem.energy[i]!;}
        const x=columns===1?0:column/(columns-1)*width;
        upper.push(`${x.toFixed(2)},${(40-(peak?max/peak:0)*35).toFixed(2)}`);
        lower.push(`${x.toFixed(2)},${(40-(peak?min/peak:0)*35).toFixed(2)}`);
        energy.push(`${x.toFixed(2)},${(24-power/(to-from)/65535*22).toFixed(2)}`);
    }
    return {waveform:`M${upper.join(' L')} L${lower.reverse().join(' L')} Z`,energy:`M0,24 L${energy.join(' L')} L${width},24 Z`,peak};
}
