import * as THREE from 'three';
import { primitiveFragment, quadVertex, effectFragment } from './compositionShaders';
import { SpectralStringsState, spectrumBands } from './spectralStringsState';
import { elementRange, orderedElements } from './compositionModel';
import { elementRegistry } from './elementRegistry';
import { elementNumber, elementValue, effectsFor, fadeOpacity, parameterKey } from './compositionEffects';
import type { VisualizerElement, VisualizerProjectV3 } from './compositionTypes';
import type { VisualizerScene, VisualizerSceneRenderInput, VisualizerResolvedParameterMap } from './rendererTypes';

export type CompositionRenderPort = Pick<THREE.WebGLRenderer,'render'|'setRenderTarget'|'clear'|'setClearColor'|'autoClear'>;
export interface CompositionSceneOptions {
    renderer: CompositionRenderPort;
    readProject(): VisualizerProjectV3 | null;
    resolveAt(time:number): VisualizerResolvedParameterMap;
}
const hashText=(text:string) => { let hash=2166136261; for(let i=0;i<text.length;i++) hash=Math.imul(hash^text.charCodeAt(i),16777619); return (hash>>>0).toString(16).padStart(8,'0'); };

/** Three reusable render targets; no additional Canvas, renderer, RAF or audio resource. */
export class CompositionScene implements VisualizerScene {
    readonly kind='rendered' as const;
    private readonly options: CompositionSceneOptions;
    private readonly scene=new THREE.Scene();
    private readonly camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    private readonly geometry=new THREE.PlaneGeometry(2,2);
    private readonly primitive: THREE.ShaderMaterial;
    private readonly effect: THREE.ShaderMaterial;
    private readonly quad: THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;
    private readonly targets=[new THREE.WebGLRenderTarget(1,1,{depthBuffer:false}),new THREE.WebGLRenderTarget(1,1,{depthBuffer:false})];
    private readonly accumulation=new THREE.WebGLRenderTarget(1,1,{depthBuffer:false});
    private readonly strings=new Map<string,SpectralStringsState>();
    private readonly levels=new Float32Array(64);
    private width=1;
    private height=1;
    private disposed=false;

    constructor(options:CompositionSceneOptions) {
        this.options=options;
        this.primitive=new THREE.ShaderMaterial({vertexShader:quadVertex,fragmentShader:primitiveFragment,depthTest:false,depthWrite:false,toneMapped:false,
            uniforms:{uKind:{value:0},uViewport:{value:new THREE.Vector2(1,1)},uColor:{value:new THREE.Color()},uPosition:{value:new THREE.Vector2(.5,.5)},
                uExtent:{value:new THREE.Vector2(1,1)},uOpacity:{value:1},uCount:{value:64},uRows:{value:5},uSize:{value:1},uSpacing:{value:10},
                uAmplitude:{value:.1},uSensitivity:{value:1},uRadius:{value:.1},uAmount:{value:0},uPhase:{value:0},uLevels:{value:new Float32Array(64)},uMotion:{value:new Float32Array(64)}}});
        this.effect=new THREE.ShaderMaterial({vertexShader:quadVertex,fragmentShader:effectFragment,depthTest:false,depthWrite:false,toneMapped:false,premultipliedAlpha:true,
            uniforms:{uImage:{value:null},uOperation:{value:0},uScale:{value:1},uOpacity:{value:1},uBlurStep:{value:new THREE.Vector2()},uFinal:{value:false}}});
        this.quad=new THREE.Mesh(this.geometry,this.primitive); this.quad.frustumCulled=false; this.scene.add(this.quad);
    }
    private clear(target:THREE.WebGLRenderTarget | null) {
        this.options.renderer.setRenderTarget(target); this.options.renderer.setClearColor('#000000',0); this.options.renderer.clear(true,false,false);
    }
    private drawPrimitive(e:VisualizerElement,input:VisualizerSceneRenderInput,seed:number) {
        const u=this.primitive.uniforms, values=input.values;
        const kinds={'solid':0,'spectral-strings':1,'spectral-dots':2,'reactive-rings':3};
        u.uKind!.value=kinds[e.type as keyof typeof kinds];
        u.uColor!.value.set(elementValue(values,e,'color') ?? '#edf5f1',THREE.LinearSRGBColorSpace);
        u.uPosition!.value.set(elementNumber(values,e,'x',.5),elementNumber(values,e,'y',.5));
        u.uExtent!.value.set(elementNumber(values,e,'width',1),elementNumber(values,e,'height',1));
        for (const [uniform,parameter,fallback] of [['uOpacity','opacity',1],['uCount','count',1],['uRows','rows',1],['uSize',e.type==='spectral-dots'?'size':'thickness',1],
            ['uSpacing','spacing',10],['uAmplitude','amplitude',0],['uSensitivity','sensitivity',1],['uRadius','radius',.1],['uAmount','amount',0]] as const)
            u[uniform]!.value=elementNumber(values,e,parameter,fallback);
        u.uPhase!.value=(seed%65536)/65536*Math.PI*2;
        const spectrum=elementValue(values,e,'spectrum'); spectrumBands(Array.isArray(spectrum)?spectrum:[],this.levels); u.uLevels!.value=this.levels;
        if (e.type==='spectral-strings') {
            let state=this.strings.get(e.id); if (!state) {state=new SpectralStringsState();this.strings.set(e.id,state);}
            const motion=state.resolve(input.timeSeconds,input.bindingRevision+':'+seed,elementNumber(values,e,'decay',.6),time=>{
                const value=this.options.resolveAt(time).get(parameterKey(e.id,'spectrum'))?.value; return Array.isArray(value)?value:[];
            });
            u.uMotion!.value=motion.position;
        }
        this.quad.material=this.primitive; this.clear(this.targets[0]!); this.options.renderer.render(this.scene,this.camera);
    }
    private pass(source:THREE.WebGLRenderTarget,target:THREE.WebGLRenderTarget | null, options:{scale?:number;opacity?:number;blurX?:number;blurY?:number;blend?:boolean;final?:boolean}={}) {
        const u=this.effect.uniforms;
        u.uImage!.value=source.texture; u.uScale!.value=options.scale ?? 1; u.uOpacity!.value=options.opacity ?? 1;
        u.uOperation!.value=options.blurX || options.blurY ? 1 : 0;
        u.uBlurStep!.value.set((options.blurX ?? 0)/1080*this.height/this.width,(options.blurY ?? 0)/1080);
        u.uFinal!.value=options.final ?? false;
        this.effect.transparent=options.blend ?? false;
        this.effect.blending=options.blend ? THREE.NormalBlending : THREE.NoBlending;
        this.quad.material=this.effect;
        if (options.blend) this.options.renderer.setRenderTarget(target); else this.clear(target);
        this.options.renderer.render(this.scene,this.camera);
    }
    private apply(source:THREE.WebGLRenderTarget,effects:readonly VisualizerElement[],project:VisualizerProjectV3,input:VisualizerSceneRenderInput) {
        let current=source;
        const other=()=>current===this.targets[0] ? this.targets[1]! : this.targets[0]!;
        for (const e of effects) {
            if (e.bindings.some(b=>input.values.get(parameterKey(e.id,b.parameterId))?.state !== 'ready')) continue;
            if (e.type==='scale') { const target=other(); this.pass(current,target,{scale:elementNumber(input.values,e,'amount',1)}); current=target; }
            else if (e.type==='fade') { const target=other(); this.pass(current,target,{opacity:fadeOpacity(project,e,input.timeSeconds,input.values)}); current=target; }
            else if (e.type==='blur') {
                const radius=elementNumber(input.values,e,'amount'); if (radius<=0) continue;
                let target=other(); this.pass(current,target,{blurX:radius}); current=target;
                target=other(); this.pass(current,target,{blurY:radius}); current=target;
            }
        }
        return current;
    }
    render(input:VisualizerSceneRenderInput) {
        if (this.disposed) throw new Error('元素合成器已释放。');
        const project=this.options.readProject(); if (!project) return {hash:'empty',needsSourcePrompt:false};
        const renderer=this.options.renderer, previousAutoClear=renderer.autoClear; renderer.autoClear=false;
        const hashes:string[]=[String(project.seed),input.timeSeconds.toFixed(6)];
        let needsSourcePrompt=false;
        try {
            this.clear(this.accumulation);
            for (const e of orderedElements(project.elements)) {
                if (!e.enabled || elementRegistry.get(e.type).kind !== 'visual') continue;
                const range=elementRange(project,e); if (!range || input.timeSeconds<range.startSeconds || input.timeSeconds>range.endSeconds) continue;
                if (e.bindings.some(b=>input.values.get(parameterKey(e.id,b.parameterId))?.state !== 'ready')) {needsSourcePrompt=true;continue;}
                this.drawPrimitive(e,input,project.seed);
                const result=this.apply(this.targets[0]!,effectsFor(project,e.id,input.timeSeconds),project,input);
                this.pass(result,this.accumulation,{blend:true});
                hashes.push(e.id,e.type,String(e.layer),JSON.stringify(e.bindings.map(b=>input.values.get(parameterKey(e.id,b.parameterId))?.value)));
                const state=this.strings.get(e.id); if (state && e.type==='spectral-strings') hashes.push(JSON.stringify(this.primitive.uniforms.uMotion!.value));
            }
            const global=effectsFor(project,null,input.timeSeconds);
            const result=this.apply(this.accumulation,global,project,input);
            this.pass(result,null,{final:true});
            for (const e of project.elements.filter(e=>e.enabled && e.targets)) hashes.push(e.id,String(e.layer),JSON.stringify(elementRange(project,e)),JSON.stringify(e.targets),JSON.stringify(e.bindings.map(b=>input.values.get(parameterKey(e.id,b.parameterId))?.value)));
            const alive=new Set(project.elements.map(e=>e.id)); for (const [id,state] of this.strings) if (!alive.has(id)) {state.reset();this.strings.delete(id);}
            return {hash:hashText(hashes.join('|')),needsSourcePrompt};
        } finally {renderer.setRenderTarget(null); renderer.autoClear=previousAutoClear;}
    }
    resize(width:number,height:number,dpr:number) {
        this.width=Math.max(1,Math.round(width*dpr)); this.height=Math.max(1,Math.round(height*dpr));
        this.primitive.uniforms.uViewport!.value.set(this.width,this.height);
        for (const target of [...this.targets,this.accumulation]) target.setSize(this.width,this.height);
    }
    dispose() {
        if (this.disposed) return; this.disposed=true;
        for(const state of this.strings.values()) state.reset(); this.strings.clear();
        this.geometry.dispose(); this.primitive.dispose(); this.effect.dispose();
        for (const target of [...this.targets,this.accumulation]) target.dispose(); this.scene.clear();
    }
}
