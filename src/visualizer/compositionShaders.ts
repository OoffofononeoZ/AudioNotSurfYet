export const quadVertex = /* glsl */`
    varying vec2 vUv;
    void main() { vUv=uv; gl_Position=vec4(position,1.0); }
`;
export const primitiveFragment = /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform int uKind;
    uniform vec2 uViewport;
    uniform vec3 uColor;
    uniform vec2 uPosition;
    uniform vec2 uExtent;
    uniform float uOpacity;
    uniform float uCount;
    uniform float uRows;
    uniform float uSize;
    uniform float uSpacing;
    uniform float uAmplitude;
    uniform float uSensitivity;
    uniform float uRadius;
    uniform float uAmount;
    uniform float uPhase;
    uniform float uLevels[64];
    uniform float uMotion[64];
    float stroke(float distance, float halfWidth) {
        float aa=max(0.6/uViewport.y,0.0001);
        return 1.0-smoothstep(halfWidth-aa,halfWidth+aa,distance);
    }
    void main() {
        float alpha=0.0;
        vec2 p=vec2(vUv.x,1.0-vUv.y)-uPosition;
        float aspect=uViewport.x/uViewport.y;
        if (uKind == 0) alpha=1.0;
        if (uKind == 1) {
            vec2 local=p/uExtent+0.5;
            float line=floor(clamp(local.x,0.0,0.9999)*uCount);
            int band=int(floor(line*63.0/max(uCount-1.0,1.0)));
            float baseline=(line+0.5)/uCount;
            float wave=uMotion[band]*uAmplitude*uSensitivity*sin(clamp(local.y,0.0,1.0)*3.14159265);
            wave*=1.0+0.22*sin(local.y*9.42477796+uPhase);
            float d=abs((local.x-baseline)*uExtent.x-wave)*aspect;
            alpha=stroke(d,uSize/2160.0)*(0.12+0.88*clamp(uLevels[band]*uSensitivity,0.0,1.0));
            alpha*=step(0.0,local.x)*step(local.x,1.0)*step(0.0,local.y)*step(local.y,1.0);
        }
        if (uKind == 2) {
            float local=p.x/uExtent.x+0.5;
            float column=floor(clamp(local,0.0,0.9999)*uCount);
            int band=int(floor(column*63.0/max(uCount-1.0,1.0)));
            float level=clamp(uLevels[band]*uSensitivity,0.0,1.0);
            float x=((column+0.5)/uCount-0.5)*uExtent.x;
            for (int row=0;row<9;row++) {
                if (float(row)>=uRows) break;
                float offset=float(row)-(uRows-1.0)*0.5;
                float direction=sign(offset);
                float y=offset*uSpacing/1080.0+direction*level*uAmplitude;
                float radius=(uSize/2160.0)*(0.45+level*2.2)/(1.0+abs(offset)*0.25);
                alpha=max(alpha,stroke(length(vec2((p.x-x)*aspect,p.y-y)),radius));
            }
            alpha*=step(0.0,local)*step(local,1.0);
        }
        if (uKind == 3) {
            float d=length(vec2(p.x*aspect,p.y));
            for (int ring=0;ring<8;ring++) {
                if (float(ring)>=uCount) break;
                float radius=(uRadius+uAmount*uAmplitude)*(1.0+float(ring)*0.32);
                alpha=max(alpha,stroke(abs(d-radius),uSize/2160.0)/(1.0+float(ring)*0.45));
            }
        }
        alpha*=uOpacity;
        gl_FragColor=vec4(uColor*alpha,alpha);
    }
`;
export const effectFragment = /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uImage;
    uniform int uOperation;
    uniform float uScale;
    uniform float uOpacity;
    uniform vec2 uBlurStep;
    uniform bool uFinal;
    vec4 sampleImage(vec2 point) {
        if (any(lessThan(point,vec2(0.0))) || any(greaterThan(point,vec2(1.0)))) return vec4(0.0);
        return texture2D(uImage,point);
    }
    void main() {
        vec2 point=(vUv-0.5)/uScale+0.5;
        vec4 value=sampleImage(point);
        if (uOperation == 1) {
            value*=0.227027;
            value+=sampleImage(point+uBlurStep*1.384615)*0.316216;
            value+=sampleImage(point-uBlurStep*1.384615)*0.316216;
            value+=sampleImage(point+uBlurStep*3.230769)*0.070270;
            value+=sampleImage(point-uBlurStep*3.230769)*0.070270;
        }
        value*=uOpacity;
        if (uFinal) value=vec4(value.rgb+vec3(2.0,4.0,3.0)/255.0*(1.0-value.a),1.0);
        gl_FragColor=value;
    }
`;
