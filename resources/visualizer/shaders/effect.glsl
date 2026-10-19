
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
