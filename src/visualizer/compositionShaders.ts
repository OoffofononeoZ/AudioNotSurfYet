export const quadVertex = /* glsl */ `
    varying vec2 vUv;
    void main() { vUv=uv; gl_Position=vec4(position,1.0); }
`;
export const compositeFragment = /* glsl */ `precision highp float;
varying vec2 vUv; uniform sampler2D uImage; uniform bool uFinal;
void main(){vec4 value=texture2D(uImage,vUv);if(uFinal)value=vec4(value.rgb+vec3(2.0,4.0,3.0)/255.0*(1.0-value.a),1.0);gl_FragColor=value;}`;
