import * as THREE from 'three';

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uWidth;
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
    float t = uTime;

    // Winding river centerline.
    float cx = 0.34 * sin(uv.y * 1.6 + 0.8) + 0.16 * sin(uv.y * 3.1 + 2.0);
    float dx = uv.x - cx;
    float d = abs(dx);

    // River half-width, gently varying along the path.
    float halfW = uWidth * (0.42 + 0.05 * sin(uv.y * 2.3 + 1.0));
    float water = 1.0 - smoothstep(halfW * 0.85, halfW, d);

    // Flowing water: noise advected downstream.
    vec2 flowUV = vec2(dx * 3.0, uv.y * 2.0 - t * 1.2);
    float n = fbm(flowUV);
    float n2 = fbm(flowUV * 2.3 + 5.0 + vec2(0.0, -t * 0.6));

    // Depth gradient: deeper toward the middle.
    float depth = 1.0 - smoothstep(0.0, halfW, d);
    vec3 deep = uColor * 0.30;
    vec3 shallow = mix(uColor, vec3(1.0), 0.25);
    vec3 waterCol = mix(shallow, deep, depth);

    // Current lines and ripples.
    float ripple = smoothstep(0.45, 0.9, n) * 0.30 + smoothstep(0.5, 0.95, n2) * 0.22;
    waterCol += ripple * mix(uColor, vec3(1.0), 0.5);

    // Moving specular glints.
    float glint = pow(smoothstep(0.66, 0.95, fbm(flowUV * 4.0 + vec2(0.0, -t * 2.0))), 3.0);
    waterCol += glint * vec3(0.85);

    // Foam streaks along the banks.
    float bankLine = smoothstep(halfW * 0.80, halfW * 0.95, d) * (1.0 - smoothstep(halfW * 0.95, halfW, d));
    waterCol += bankLine * noise(vec2(dx * 8.0, uv.y * 6.0 - t * 2.0)) * mix(uColor, vec3(1.0), 0.7) * 0.6;

    // Terrain banks.
    float terrain = fbm(uv * 3.0 + 20.0);
    vec3 land = mix(vec3(0.045, 0.08, 0.05), vec3(0.11, 0.17, 0.09), terrain);
    float edge = smoothstep(halfW, halfW * 1.25, d) * (1.0 - smoothstep(halfW * 1.25, halfW * 1.7, d));
    land = mix(land, vec3(0.32, 0.28, 0.19), edge * 0.55);

    vec3 col = mix(land, waterCol, water);

    // Soft vignette.
    col *= 1.0 - 0.35 * dot(uv * 0.5, uv * 0.5);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class River {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly uniforms: {
    uTime: { value: number };
    uWidth: { value: number };
    uColor: { value: THREE.Color };
    uResolution: { value: THREE.Vector2 };
  };
  private time = 0;

  constructor() {
    this.uniforms = {
      uTime: { value: 0 },
      uWidth: { value: 1 },
      uColor: { value: new THREE.Color('#2f9bff') },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      depthWrite: false,
      depthTest: false,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
  }

  setColor(hex: string): void {
    this.uniforms.uColor.value.set(hex);
  }

  setSize(width: number): void {
    this.uniforms.uWidth.value = width;
  }

  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
  }

  update(dt: number, speed: number): void {
    this.time += dt * speed;
    this.uniforms.uTime.value = this.time;
  }
}