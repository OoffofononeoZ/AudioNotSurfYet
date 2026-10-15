import * as THREE from 'three';
import { GeometricBatch } from './geometricBatch';
import { buildGeometricElement } from './geometricElements';
import type { VisualizerElement } from './compositionTypes';
import type { VisualizerSceneRenderInput } from './rendererTypes';
import type { CompositionRenderPort } from './compositionScene';

/** One shared geometry/material for all geometric atoms, drawn through the existing host. */
export class GeometricElementRenderer {
    private batch=new GeometricBatch();
    private levels=new Float32Array(128);
    private scene=new THREE.Scene();
    private camera=new THREE.OrthographicCamera(-1,1,-.5,.5,-1,1);
    private geometry=new THREE.BufferGeometry();
    private material=new THREE.ShaderMaterial({
        vertexShader:'attribute vec4 ink; attribute vec2 edge; varying vec4 vInk; varying vec2 vEdge; void main(){vInk=ink;vEdge=edge; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'varying vec4 vInk; varying vec2 vEdge; void main(){float aa=max(fwidth(vEdge.x),0.000001);float alpha=vInk.a*(1.0-smoothstep(vEdge.y-aa*.5,vEdge.y+aa*.5,abs(vEdge.x)));gl_FragColor=vec4(vInk.rgb*alpha,alpha);}',
        transparent:true,premultipliedAlpha:true,depthTest:false,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    });
    private aspect=16/9;
    constructor() {
        this.geometry.setAttribute('position',new THREE.BufferAttribute(this.batch.positions,3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('ink',new THREE.BufferAttribute(this.batch.colors,4).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('edge',new THREE.BufferAttribute(this.batch.edges,2).setUsage(THREE.DynamicDrawUsage));
        const mesh=new THREE.Mesh(this.geometry,this.material);mesh.frustumCulled=false;this.scene.add(mesh);
    }
    resize(width:number,height:number) {
        this.aspect=width/height;this.batch.pixelSize=1/height;this.camera.left=-this.aspect/2;this.camera.right=this.aspect/2;this.camera.updateProjectionMatrix();
    }
    render(renderer:CompositionRenderPort,e:VisualizerElement,input:VisualizerSceneRenderInput,seed:number) {
        const count=buildGeometricElement(this.batch,e,input.values,input.timeSeconds,seed,this.aspect,this.levels);
        for(const name of ['position','ink','edge']) {
            const attribute=this.geometry.getAttribute(name) as THREE.BufferAttribute;
            attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;
        }
        this.geometry.setDrawRange(0,count);renderer.render(this.scene,this.camera);
    }
    dispose(){this.geometry.dispose();this.material.dispose();this.scene.clear();}
}
