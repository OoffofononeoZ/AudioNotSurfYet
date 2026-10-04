// Diagnostic only. Original pinned artifacts are never overwritten.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import protobuf from 'protobufjs';
const source='artifacts/fixtures/p1-models/htdemucs_ft_drums_fp16weights.onnx';
const data=await fs.readFile(source);
const sourceSha=createHash('sha256').update(data).digest('hex');
if(sourceSha!=='047764dff888cfb87da917013377d4ec7a134f7419cbe486d9c339aa17975ddd')throw Error('Unexpected source graph');
const schema=await fs.readFile('artifacts/fixtures/p1-models/onnx.proto3','utf8');
const type=protobuf.parse(schema.replace(/^\uFEFF/,'')).root.lookupType('onnx.ModelProto');
const model=type.decode(data),changes=[];
for(const node of model.graph.node)for(const attr of node.attribute){
    if(attr.t?.dataType===11){
        if(!node.name.startsWith('/real_istft/'))throw Error('Unexpected DOUBLE outside window envelope');
        const t=attr.t;if(!t.rawData.length)throw Error('Unsupported DOUBLE encoding');
        const original=new DataView(t.rawData.buffer,t.rawData.byteOffset,t.rawData.byteLength),out=new Uint8Array(t.rawData.length/2),view=new DataView(out.buffer);
        for(let i=0;i<out.length/4;i++){const v=original.getFloat64(i*8,true);if(!Number.isFinite(v))throw Error('Invalid constant');view.setFloat32(i*4,v,true);}
        t.rawData=out;t.dataType=1;changes.push(node.name);
    }
}
const bytes=type.encode(model).finish(),sha256=createHash('sha256').update(bytes).digest('hex');
await fs.mkdir('artifacts/fixtures/p1-probe',{recursive:true});
await fs.writeFile('artifacts/fixtures/p1-probe/drums-window-f32.onnx',bytes);
await fs.writeFile('artifacts/fixtures/p1-probe/graph.json',JSON.stringify({diagnosticOnly:true,version:'istft-window-f32-probe-v1',sourceSha,sha256,bytes:bytes.length,changedConstantCount:changes.length,changes},null,2));
console.log(JSON.stringify({sourceSha,sha256,bytes:bytes.length,changedConstantCount:changes.length}));
const observed=type.decode(data);
const outputs=['/real_stft/Conv_output_0','/real_stft/Conv_1_output_0','/real_istft/Gather_5_output_0','/real_istft/Gather_6_output_0','/real_istft/ConvTranspose_output_0','/real_istft/ConvTranspose_1_output_0'];
outputs.push(...observed.graph.node.filter(n=>['Sin','Cos'].includes(n.opType)).flatMap(n=>n.output));
outputs.push('/Add_4_output_0','/Slice_5_output_0');
outputs.push(...observed.graph.node.filter(n=>n.opType==='Conv'&&/^\/(?:tencoder|encoder)\.0\/conv\/Conv$/.test(n.name)).flatMap(n=>n.output));
outputs.push(...observed.graph.node.filter(n=>['ReduceMean','Sqrt'].includes(n.opType)&&/^\/[^/]+$/.test(n.name)).flatMap(n=>n.output));
outputs.push(...observed.graph.node.filter(n=>n.opType==='Conv'&&/^\/(?:tencoder|encoder)\.0\/conv\/Conv$/.test(n.name)).map(n=>n.input[0]));
for(const name of outputs){if(!observed.graph.node.some(n=>n.output.includes(name)))throw Error(`Missing tensor ${name}`);observed.graph.output.push({name,type:{tensorType:{elemType:1}}});}
const observedBytes=type.encode(observed).finish();
await fs.writeFile('artifacts/fixtures/p1-probe/drums-observe.onnx',observedBytes);
await fs.writeFile('artifacts/fixtures/p1-probe/observe.json',JSON.stringify({diagnosticOnly:true,version:'spectral-observation-v1',sourceSha,sha256:createHash('sha256').update(observedBytes).digest('hex'),bytes:observedBytes.length,outputs},null,2));
