import type { CompositionDraftRepositoryPort } from './compositionDraftRepository';
import type { VisualizerProjectV3 } from './compositionTypes';
export class CompositionDraftWriter {
    private repository:CompositionDraftRepositoryPort;
    private notify:(state:'saving'|'saved'|'not-persisted',project:VisualizerProjectV3,message?:string)=>void;
    private pending:VisualizerProjectV3|null=null;
    private active:Promise<boolean>|null=null;
    private timer:ReturnType<typeof setTimeout>|null=null;
    constructor(repository:CompositionDraftRepositoryPort, notify:CompositionDraftWriter['notify']) {this.repository=repository;this.notify=notify;}
    hasPending() {return !!(this.pending || this.active);}
    queue(project:VisualizerProjectV3) {
        this.pending=structuredClone(project); if(this.timer)clearTimeout(this.timer);
        this.timer=setTimeout(()=>{this.timer=null;void this.flush();},250);
    }
    async flush():Promise<boolean> {
        if(this.timer){clearTimeout(this.timer);this.timer=null;}
        if(this.active && !await this.active) return false;
        if(!this.pending) return true;
        const project=this.pending;this.pending=null;this.notify('saving',project);
        this.active=this.repository.replace({schemaVersion:3,savedAt:new Date().toISOString(),project}).then(()=>{
            this.notify(this.pending?'saving':'saved',project);return true;
        },error=>{if(!this.pending)this.pending=project;this.notify('not-persisted',project,(error as Error).message);return false;});
        const success=await this.active;this.active=null;
        return success && (this.pending ? this.flush() : true);
    }
}
