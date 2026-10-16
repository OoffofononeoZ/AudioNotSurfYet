/** Adapt a frequency axis to a closed contour; never modify the source signal or its peak. */
export function createRadialSpectrumSampler(levels:ArrayLike<number>):(index:number)=>number {
    const count=levels.length,channelSize=count/2;
    if(!count)return ()=>0;
    const displayEnd=(start:number)=>{
        let peak=0;for(let i=0;i<channelSize;i++)peak=Math.max(peak,levels[start+i]??0);
        if(peak===0)return channelSize-1;
        let end=channelSize-1;
        while(end>0&&(levels[start+end]??0)<=peak*.001)end--;
        // Leave ordinary short quiet tails unchanged. Only shorten long inactive runs,
        // retaining four source bands so the contour can still reach genuine zero.
        return channelSize-1-end>8?Math.min(channelSize-1,end+4):channelSize-1;
    };
    const leftEnd=displayEnd(0),rightEnd=displayEnd(channelSize);
    const raw=(index:number)=>{
        const wrapped=((index%count)+count)%count,start=wrapped<channelSize?0:channelSize;
        const end=start===0?leftEnd:rightEnd;
        if(end===channelSize-1)return levels[wrapped]??0;
        const position=(wrapped-start)/(channelSize-1)*end;
        const bin=Math.floor(position),ratio=position-bin;
        const a=levels[start+bin]??0,b=levels[start+Math.min(channelSize-1,bin+1)]??0;
        return a+(b-a)*ratio;
    };
    return index=>{
        const wrapped=((index%count)+count)%count,start=wrapped<channelSize?0:channelSize,local=wrapped-start;
        const previousEnd=start===0?rightEnd:leftEnd,ownEnd=start===0?leftEnd:rightEnd;
        // Bridge only two samples at a shortened seam. Unaffected spectra keep their exact order/values.
        if(local<2&&previousEnd<channelSize-1){const join=(raw(start-1)+raw(start))/2;return join+(raw(wrapped)-join)*local/2;}
        if(local>=channelSize-2&&ownEnd<channelSize-1){const join=(raw(start+channelSize-1)+raw(start+channelSize))/2;return join+(raw(wrapped)-join)*(channelSize-1-local)/2;}
        return raw(wrapped);
    };
}
