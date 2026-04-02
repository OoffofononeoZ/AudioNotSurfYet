<!--
    修改自 vue-bits 的 light-rays 组件。
    props：
    - raysOrigin<RaysOrigin>: 光线源的位置
    - raysColor<string>: 光线颜色
    - raysSpeed<number>: 光线速度
    - lightSpread<number>: 光线扩散
    - rayLength<number>: 光线长度
    - fadeDistance<number>: 光线渐隐距离
    - saturation<number>: 光线饱和度
    - followMouse<boolean>: 是否跟随鼠标
    - mouseInfluence<number>: 鼠标影响
    - className<string>: 类名
-->
<template>
    <div ref="containerRef" :class="['w-full h-full relative z-[3] pointer-events-none overflow-hidden', className]">
        <slot></slot>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, useTemplateRef, computed, nextTick } from 'vue';
import * as THREE from 'three';

export type RaysOrigin =
    | 'top-center'
    | 'top-left'
    | 'top-right'
    | 'right'
    | 'left'
    | 'bottom-center'
    | 'bottom-right'
    | 'bottom-left';

interface LightRaysProps {
    raysOrigin?: RaysOrigin;
    raysColor?: string;
    raysSpeed?: number;
    lightSpread?: number;
    rayLength?: number;
    fadeDistance?: number;
    saturation?: number;
    followMouse?: boolean;
    mouseInfluence?: number;
    className?: string;
}

interface MousePosition {
    x: number;
    y: number;
}

interface AnchorAndDirection {
    anchor: [number, number];
    dir: [number, number];
}

interface LightRaysUniforms {
    [key: string]: THREE.IUniform;
    iTime: THREE.IUniform<number>;
    iResolution: THREE.IUniform<[number, number]>;
    rayPos: THREE.IUniform<[number, number]>;
    rayDir: THREE.IUniform<[number, number]>;
    raysColor: THREE.IUniform<[number, number, number]>;
    raysSpeed: THREE.IUniform<number>;
    lightSpread: THREE.IUniform<number>;
    rayLength: THREE.IUniform<number>;
    fadeDistance: THREE.IUniform<number>;
    saturation: THREE.IUniform<number>;
    mousePos: THREE.IUniform<[number, number]>;
    mouseInfluence: THREE.IUniform<number>;
}

type LightRaysShaderMaterial = THREE.ShaderMaterial & { uniforms: LightRaysUniforms };

const props = withDefaults(defineProps<LightRaysProps>(), {
    raysOrigin: 'top-center',
    raysColor: '#ffffff',
    raysSpeed: 1,
    lightSpread: 1,
    rayLength: 2,
    fadeDistance: 1.0,
    saturation: 1.0,
    followMouse: true,
    mouseInfluence: 0.1,
    className: ''
});

const containerRef = useTemplateRef<HTMLDivElement>('containerRef');

const rendererRef = ref<THREE.WebGLRenderer | null>(null);
const sceneRef = ref<THREE.Scene | null>(null);
const cameraRef = ref<THREE.OrthographicCamera | null>(null);
const meshRef = ref<THREE.Mesh | null>(null);
const materialRef = ref<LightRaysShaderMaterial | null>(null);

const mouseRef = ref<MousePosition>({ x: 0.5, y: 0.5 });
const smoothMouseRef = ref<MousePosition>({ x: 0.5, y: 0.5 });
const animationIdRef = ref<number | null>(null);
const cleanupFunctionRef = ref<(() => void) | null>(null);
const isVisible = ref<boolean>(false);
const observerRef = ref<IntersectionObserver | null>(null);
const resizeTimeoutRef = ref<number | null>(null);

const rgbColor = computed<[number, number, number]>(() => hexToRgb(props.raysColor));
const devicePixelRatio = computed<number>(() => Math.min(window.devicePixelRatio || 1, 2));

const hexToRgb = (hex: string): [number, number, number] => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? [parseInt(m[1] as string, 16) / 255, parseInt(m[2] as string, 16) / 255, parseInt(m[3] as string, 16) / 255] : [1, 1, 1];
};

const getAnchorAndDir = (origin: RaysOrigin, w: number, h: number): AnchorAndDirection => {
    const outside = 0.2;
    switch (origin) {
        case 'top-left':
            return { anchor: [0, -outside * h], dir: [0, 1] };
        case 'top-right':
            return { anchor: [w, -outside * h], dir: [0, 1] };
        case 'left':
            return { anchor: [-outside * w, 0.5 * h], dir: [1, 0] };
        case 'right':
            return { anchor: [(1 + outside) * w, 0.5 * h], dir: [-1, 0] };
        case 'bottom-left':
            return { anchor: [0, (1 + outside) * h], dir: [0, -1] };
        case 'bottom-center':
            return { anchor: [0.5 * w, (1 + outside) * h], dir: [0, -1] };
        case 'bottom-right':
            return { anchor: [w, (1 + outside) * h], dir: [0, -1] };
        default:
            return { anchor: [0.5 * w, -outside * h], dir: [0, 1] };
    }
};

const debouncedUpdatePlacement = (() => {
    let timeoutId: number | null = null;

    return (updateFn: () => void): void => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
            updateFn();
            timeoutId = null;
        }, 16);
    };
})();

const vertexShader: string = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const fragmentShader: string = `precision highp float;
  
  uniform float iTime;
  uniform vec2  iResolution;
  
  uniform vec2  rayPos;
  uniform vec2  rayDir;
  uniform vec3  raysColor;
  uniform float raysSpeed;
  uniform float lightSpread;
  uniform float rayLength;
  uniform float fadeDistance;
  uniform float saturation;
  uniform vec2  mousePos;
  uniform float mouseInfluence;
  
  varying vec2 vUv;
  
  float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord,
                    float seedA, float seedB, float speed) {
    vec2 sourceToCoord = coord - raySource;
    vec2 dirNorm = normalize(sourceToCoord);
    float cosAngle = dot(dirNorm, rayRefDirection);
  
    // No distortion applied — original angle used directly
    float spreadFactor = pow(max(cosAngle, 0.0), 1.0 / max(lightSpread, 0.001));
  
    float distance = length(sourceToCoord);
    float maxDistance = iResolution.x * rayLength;
    float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
  
    float fadeFalloff = clamp((iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance), 0.5, 1.0);
  
    // Pulsation removed — always 1.0
    float baseStrength = clamp(
      (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
      (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
      0.0, 1.0
    );
  
    return baseStrength * lengthFalloff * fadeFalloff * spreadFactor;
  }
  
  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
  
    vec2 finalRayDir = rayDir;
    if (mouseInfluence > 0.0) {
      vec2 mouseScreenPos = mousePos * iResolution.xy;
      vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
      finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
    }
  
    vec4 rays1 = vec4(1.0) *
                 rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349,
                             1.5 * raysSpeed);
    vec4 rays2 = vec4(1.0) *
                 rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234,
                             1.1 * raysSpeed);
  
    fragColor = rays1 * 0.5 + rays2 * 0.4;
  
    // Noise modulation removed
  
    float brightness = 1.0 - (coord.y / iResolution.y);
    fragColor.x *= 0.1 + brightness * 0.8;
    fragColor.y *= 0.3 + brightness * 0.6;
    fragColor.z *= 0.5 + brightness * 0.5;
  
    if (saturation != 1.0) {
      float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
      fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
    }
  
    fragColor.rgb *= raysColor;
  }
  
  void main() {
    vec4 color;
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
  }`;

const initializeWebGL = async (): Promise<void> => {
    if (!containerRef.value) return;
    await nextTick();
    if (!containerRef.value) return;

    try {
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            alpha: true,
            powerPreference: 'high-performance'
        });

        renderer.setPixelRatio(devicePixelRatio.value);
        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.value;
        renderer.setSize(wCSS, hCSS);
        containerRef.value.appendChild(renderer.domElement);

        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                iTime: { value: 0 },
                iResolution: { value: [wCSS * devicePixelRatio.value, hCSS * devicePixelRatio.value] },
                rayPos: { value: [0, 0] },
                rayDir: { value: [0, 1] },
                raysColor: { value: rgbColor.value },
                raysSpeed: { value: props.raysSpeed },
                lightSpread: { value: props.lightSpread },
                rayLength: { value: props.rayLength },
                fadeDistance: { value: props.fadeDistance },
                saturation: { value: props.saturation },
                mousePos: { value: [0.5, 0.5] },
                mouseInfluence: { value: props.mouseInfluence }
            } satisfies LightRaysUniforms,
            transparent: true,
            depthWrite: false,
            depthTest: false
        }) as LightRaysShaderMaterial;

        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        sceneRef.value = scene;
        cameraRef.value = camera;
        rendererRef.value = renderer;
        meshRef.value = mesh;
        materialRef.value = material;

        const updatePlacement = (): void => {
            if (!containerRef.value || !renderer) return;

            const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.value;
            renderer.setPixelRatio(devicePixelRatio.value);
            renderer.setSize(wCSS, hCSS);

            const dpr = devicePixelRatio.value;
            const w = wCSS * dpr;
            const h = hCSS * dpr;


            material.uniforms.iResolution.value = [w, h];
            const { anchor, dir } = getAnchorAndDir(props.raysOrigin, w, h);
            material.uniforms.rayPos.value = anchor;
            material.uniforms.rayDir.value = dir;
        };

        const loop = (t: number): void => {
            if (!rendererRef.value || !materialRef.value || !meshRef.value || !isVisible.value) {
                return;
            }

            materialRef.value.uniforms.iTime.value = t * 0.001;

            if (props.followMouse && props.mouseInfluence > 0.0) {
                const smoothing = 0.92;

                smoothMouseRef.value.x = smoothMouseRef.value.x * smoothing + mouseRef.value.x * (1 - smoothing);
                smoothMouseRef.value.y = smoothMouseRef.value.y * smoothing + mouseRef.value.y * (1 - smoothing);

                materialRef.value.uniforms.mousePos.value = [smoothMouseRef.value.x, smoothMouseRef.value.y];
            }

            try {
                renderer.render(scene, camera);
                animationIdRef.value = requestAnimationFrame(loop);
            } catch (error) {
                console.warn('Three.js rendering error:', error);
                return;
            }
        };

        const handleResize = (): void => {
            debouncedUpdatePlacement(updatePlacement);
        };

        window.addEventListener('resize', handleResize, { passive: true });
        updatePlacement();
        animationIdRef.value = requestAnimationFrame(loop);

        cleanupFunctionRef.value = (): void => {
            if (animationIdRef.value) {
                cancelAnimationFrame(animationIdRef.value);
                animationIdRef.value = null;
            }

            window.removeEventListener('resize', handleResize);

            if (resizeTimeoutRef.value) {
                clearTimeout(resizeTimeoutRef.value);
                resizeTimeoutRef.value = null;
            }

            if (renderer) {
                renderer.dispose();
                if (renderer.domElement.parentNode) {
                    renderer.domElement.parentNode.removeChild(renderer.domElement);
                }
            }

            sceneRef.value = null;
            cameraRef.value = null;
            rendererRef.value = null;
            meshRef.value = null;
            materialRef.value = null;
        };
    } catch (error) {
        console.error('Failed to initialize Three.js:', error);
    }
};

let mouseThrottleId: number | null = null;
const handleMouseMove = (e: MouseEvent): void => {
    if (!containerRef.value || !rendererRef.value) return;

    if (mouseThrottleId) return;

    mouseThrottleId = requestAnimationFrame(() => {
        if (!containerRef.value) return;

        const rect = containerRef.value.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        mouseRef.value = { x, y };
        mouseThrottleId = null;
    });
};

onMounted((): void => {
    if (!containerRef.value) return;

    observerRef.value = new IntersectionObserver(
        (entries: IntersectionObserverEntry[]): void => {
            const entry = entries[0];
            if (entry) isVisible.value = entry.isIntersecting;
        },
        {
            threshold: 0.1,
            rootMargin: '50px'
        }
    );

    observerRef.value.observe(containerRef.value);
});

watch(isVisible, (newVisible: boolean): void => {
    if (newVisible && containerRef.value) {
        if (cleanupFunctionRef.value) {
            cleanupFunctionRef.value();
            cleanupFunctionRef.value = null;
        }
        initializeWebGL();
    } else if (!newVisible && cleanupFunctionRef.value) {
        if (animationIdRef.value) {
            cancelAnimationFrame(animationIdRef.value);
            animationIdRef.value = null;
        }
    }
});

watch(
    [
        () => props.raysColor,
        () => props.raysSpeed,
        () => props.lightSpread,
        () => props.raysOrigin,
        () => props.rayLength,
        () => props.fadeDistance,
        () => props.saturation,
        () => props.mouseInfluence
    ],
    (): void => {
        if (!materialRef.value || !containerRef.value) return;

        const mat = materialRef.value;

        mat.uniforms.raysColor.value = rgbColor.value;
        mat.uniforms.raysSpeed.value = props.raysSpeed;
        mat.uniforms.lightSpread.value = props.lightSpread;
        mat.uniforms.rayLength.value = props.rayLength;
        mat.uniforms.fadeDistance.value = props.fadeDistance;
        mat.uniforms.saturation.value = props.saturation;
        mat.uniforms.mouseInfluence.value = props.mouseInfluence;

        const { clientWidth: wCSS, clientHeight: hCSS } = containerRef.value;
        const dpr = devicePixelRatio.value;
        const { anchor, dir } = getAnchorAndDir(props.raysOrigin, wCSS * dpr, hCSS * dpr);
        mat.uniforms.rayPos.value = anchor;
        mat.uniforms.rayDir.value = dir;
    },
    { flush: 'post' }
);

watch(
    () => props.followMouse,
    (newFollowMouse: boolean): void => {
        if (newFollowMouse) {
            window.addEventListener('mousemove', handleMouseMove, { passive: true });
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            if (mouseThrottleId) {
                cancelAnimationFrame(mouseThrottleId);
                mouseThrottleId = null;
            }
        }
    },
    { immediate: true }
);

onUnmounted((): void => {
    if (observerRef.value) {
        observerRef.value.disconnect();
        observerRef.value = null;
    }

    if (cleanupFunctionRef.value) {
        cleanupFunctionRef.value();
        cleanupFunctionRef.value = null;
    }

    if (mouseThrottleId) {
        cancelAnimationFrame(mouseThrottleId);
        mouseThrottleId = null;
    }

    window.removeEventListener('mousemove', handleMouseMove);
});
</script>