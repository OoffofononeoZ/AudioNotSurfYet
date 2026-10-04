import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute=promisify(execFile);
export async function systemEnvironment(){
    const command="Add-Type -AssemblyName System.Windows.Forms; $p1Machine=Get-CimInstance Win32_ComputerSystem; [pscustomobject]@{ramBytes=$p1Machine.TotalPhysicalMemory;powerLineStatus=[System.Windows.Forms.SystemInformation]::PowerStatus.PowerLineStatus.ToString()} | ConvertTo-Json -Compress";
    const [system,gpu]=await Promise.all([execute('powershell',['-NoProfile','-Command',command]),execute('nvidia-smi',['--query-gpu=name,memory.total,driver_version','--format=csv,noheader'])]);
    return {system:JSON.parse(system.stdout),gpu:gpu.stdout.trim()};
}
export async function startSystemSampler(){
    const samples:Array<{at:number;gpuUsedMiB:number;browserWorkingSetBytes:number;browserPrivateBytes:number}>=[],errors:string[]=[];
    const started=Date.now();let stopped=false,pending:Promise<void>|null=null;
    const sample=async()=>{
        try{
            const [gpu,browser]=await Promise.all([
                execute('nvidia-smi',['--query-gpu=memory.used','--format=csv,noheader,nounits']),
                execute('powershell',['-NoProfile','-Command',"$p1Browsers=Get-Process chrome,msedge -ErrorAction SilentlyContinue; [pscustomobject]@{workingSet=($p1Browsers | Measure-Object WorkingSet64 -Sum).Sum;privateBytes=($p1Browsers | Measure-Object PrivateMemorySize64 -Sum).Sum} | ConvertTo-Json -Compress"]),
            ]);
            const data=JSON.parse(browser.stdout);samples.push({at:Date.now()-started,gpuUsedMiB:Number(gpu.stdout.trim()),browserWorkingSetBytes:Number(data.workingSet),browserPrivateBytes:Number(data.privateBytes)});
        }catch(e){errors.push(String(e));}
    };
    await sample();
    const timer=setInterval(()=>{if(!stopped&&!pending){pending=sample().finally(()=>{pending=null;});}},1000);
    return async()=>{
        stopped=true;clearInterval(timer);if(pending)await pending;await sample();
        return {method:'1s requested sampling; device-wide NVIDIA memory and aggregate all Chrome/Edge process working sets/private bytes, including other tabs; shared WS may double-count; observed peaks, not allocation guarantees',samples,errors,
            peakGpuUsedMiB:Math.max(...samples.map(s=>s.gpuUsedMiB)),peakBrowserWorkingSetBytes:Math.max(...samples.map(s=>s.browserWorkingSetBytes)),peakBrowserPrivateBytes:Math.max(...samples.map(s=>s.browserPrivateBytes))};
    };
}
