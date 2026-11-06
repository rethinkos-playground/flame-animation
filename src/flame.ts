import * as THREE from 'three';

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uSize;
  uniform vec3 uColor;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p = rot * p * 2.0 + 11.7;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
    // Anchor the flame base near the bottom of the screen, then scale.
    uv.y += 0.78;
    uv /= uSize;

    float t = uTime;
    float h = uv.y; // height above the flame base

    // Rising turbulence, stronger towards the tip.
    float sway = fbm(vec2(uv.x * 2.5, h * 1.8 - t * 1.6)) - 0.5;
    float x = uv.x + sway * (0.12 + 0.5 * smoothstep(0.0, 1.3, h));

    // Teardrop envelope: wide at the base, tapering to the tip.
    float hn = clamp(h / 1.7, 0.0, 1.0);
    float radius = 0.46 * pow(1.0 - hn, 1.35) + 0.015;
    float body = 1.0 - smoothstep(radius * 0.15, radius, abs(x));

    // Licking flames / inner detail scrolling upwards.
    float detail = fbm(vec2(x * 5.0, h * 3.5 - t * 3.2));
    float flame = body * smoothstep(0.25, 0.85, detail * 0.65 + body * 0.45);

    // Fade in at the base, fade out at the tip.
    flame *= smoothstep(-0.05, 0.12, h);
    flame *= 1.0 - smoothstep(0.72, 1.0, hn);

    // Global flicker.
    flame *= 0.82 + 0.18 * noise(vec2(t * 3.1, h * 2.0));

    // Color grading: dim edge -> main color -> near-white hot core.
    vec3 hot = mix(uColor, vec3(1.0, 0.98, 0.92), 0.85);
    vec3 col = mix(uColor * 0.25, uColor, smoothstep(0.05, 0.55, flame));
    col = mix(col, hot, smoothstep(0.55, 0.95, flame));

    // Extra heat at the bottom center.
    float core = (1.0 - smoothstep(0.0, 0.35, abs(x))) * (1.0 - smoothstep(0.0, 0.5, h));
    col = mix(col, hot, core * 0.6);

    // Soft ambient glow + ground light.
    float glow = exp(-3.5 * length(vec2(uv.x * 1.4, max(h - 0.45, 0.0) * 0.9))) * 0.30;
    float ground = exp(-8.0 * length(vec2(uv.x * 1.2, (h + 0.02) * 3.0))) * 0.45;
    float energy = flame + glow + ground;

    gl_FragColor = vec4(col * energy + uColor * (glow + ground) * 0.6, 1.0);
  }
`;

export interface FlameUniforms {
  [uniform: string]: THREE.IUniform;
  uTime: { value: number };
  uSize: { value: number };
  uColor: { value: THREE.Color };
  uResolution: { value: THREE.Vector2 };
}

export class Flame {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly uniforms: FlameUniforms;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: 1 },
      uColor: { value: new THREE.Color('#ff6a00') },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
  }

  setColor(hex: string): void {
    this.uniforms.uColor.value.set(hex);
  }

  setSize(size: number): void {
    this.uniforms.uSize.value = size;
  }

  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }
}