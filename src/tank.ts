import * as THREE from 'three';

const COLUMNS = 128;
const HALF_W = 0.85;
const HALF_H = 0.6;

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uFill;
  uniform vec3 uColor;
  uniform vec2 uPos;
  uniform vec2 uHalf;
  uniform vec2 uResolution;
  uniform sampler2D uHeights;

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
    for (int i = 0; i < 4; i++) {
      v += amp * noise(p);
      p = rot * p * 2.0 + 11.7;
      amp *= 0.5;
    }
    return v;
  }

  vec3 background(vec2 uv) {
    vec3 bg = mix(vec3(0.015, 0.02, 0.03), vec3(0.05, 0.06, 0.085), uv.y * 0.5 + 0.5);
    vec2 g = fract(uv * 2.0);
    bg += (step(g.x, 0.02) + step(g.y, 0.02)) * 0.015;
    bg *= 1.0 - 0.4 * dot(uv * 0.4, uv * 0.4);
    return bg;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
    vec2 local = uv - uPos;
    vec2 hf = uHalf;
    float glass = 0.035;
    vec2 inner = hf - glass;

    float outer = step(abs(local.x), hf.x) * step(abs(local.y), hf.y);
    float innerM = step(abs(local.x), inner.x) * step(abs(local.y), inner.y);
    float wall = outer - innerM;

    // Water surface from the simulated heightfield.
    float xn = clamp(local.x / (2.0 * inner.x) + 0.5, 0.0, 1.0);
    vec4 hs = texture2D(uHeights, vec2(xn, 0.5));
    float h = (hs.r - 0.5) * 2.0;
    float agit = hs.g;
    float restY = -inner.y + uFill * 2.0 * inner.y;
    float surfY = restY + h;

    float inWater = innerM * step(local.y, surfY);
    float depth = clamp(surfY - local.y, 0.0, 2.0 * inner.y);

    // Water body: depth gradient + caustics.
    vec3 shallow = mix(uColor, vec3(1.0), 0.35);
    vec3 deep = uColor * 0.22;
    vec3 wcol = mix(shallow, deep, clamp(depth / 1.1, 0.0, 1.0));
    float ca = fbm(vec2(local.x * 3.0, local.y * 3.0 - uTime * 0.5));
    wcol += pow(ca, 3.0) * 0.28 * mix(uColor, vec3(1.0), 0.6) * (1.0 - depth * 0.4);

    // Rising bubbles.
    float bub = smoothstep(0.92, 0.98, noise(vec2(local.x * 20.0, local.y * 20.0 - uTime * 2.0)));
    wcol += bub * 0.15;

    // Meniscus + agitation foam at the surface.
    float surf = 1.0 - smoothstep(0.0, 0.03, abs(local.y - surfY));
    wcol += surf * mix(uColor, vec3(1.0), 0.7) * 0.6;
    float foam = agit * (1.0 - smoothstep(0.0, 0.12, abs(local.y - surfY)));
    wcol += foam * vec3(0.9) * 0.5;

    // Glass walls: faint tint + bright rim + specular streaks.
    vec3 glassCol = vec3(0.6, 0.75, 0.85);
    float border = outer * (1.0 - step(abs(local.x), hf.x - 0.012) * step(abs(local.y), hf.y - 0.012));
    float streak = pow(noise(vec2(local.y * 6.0, 3.0)), 3.0) * wall;
    vec3 gcol = glassCol * 0.08 + border * glassCol * 0.7 + streak * glassCol * 0.25;

    vec3 col = background(uv);

    // Soft contact shadow under the tank.
    float shadow = exp(-6.0 * length(vec2(local.x * 0.9, (local.y + hf.y + 0.08) * 3.0)));
    col *= 1.0 - shadow * 0.4;

    col = mix(col, wcol, inWater);
    col = mix(col, glassCol * 0.05, innerM * (1.0 - inWater) * 0.5);
    col = mix(col, gcol, wall);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class WaterTank {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;

  private readonly uniforms: {
    uTime: { value: number };
    uFill: { value: number };
    uColor: { value: THREE.Color };
    uPos: { value: THREE.Vector2 };
    uHalf: { value: THREE.Vector2 };
    uResolution: { value: THREE.Vector2 };
    uHeights: { value: THREE.DataTexture };
  };

  private readonly heights = new Float32Array(COLUMNS);
  private readonly velocities = new Float32Array(COLUMNS);
  private readonly heightData = new Uint8Array(COLUMNS * 4);
  private readonly heightTex: THREE.DataTexture;

  private time = 0;
  private readonly pos = new THREE.Vector2(0, -0.05);
  private readonly targetPos = new THREE.Vector2(0, -0.05);
  private readonly prevVel = new THREE.Vector2();
  private readonly accel = new THREE.Vector2();
  private readonly dragOffset = new THREE.Vector2();
  private dragging = false;
  private extentX = 1;
  private extentY = 1;

  constructor() {
    this.heightTex = new THREE.DataTexture(this.heightData, COLUMNS, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.heightTex.magFilter = THREE.LinearFilter;
    this.heightTex.minFilter = THREE.LinearFilter;
    this.heightTex.wrapS = THREE.ClampToEdgeWrapping;
    this.heightTex.needsUpdate = true;

    this.uniforms = {
      uTime: { value: 0 },
      uFill: { value: 0.55 },
      uColor: { value: new THREE.Color('#2f9bff') },
      uPos: { value: this.pos },
      uHalf: { value: new THREE.Vector2(HALF_W, HALF_H) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uHeights: { value: this.heightTex },
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

  setSize(fill: number): void {
    this.uniforms.uFill.value = fill;
  }

  setResolution(width: number, height: number): void {
    this.uniforms.uResolution.value.set(width, height);
    const m = Math.min(width, height);
    this.extentX = width / m;
    this.extentY = height / m;
  }

  contains(x: number, y: number): boolean {
    return Math.abs(x - this.pos.x) < HALF_W && Math.abs(y - this.pos.y) < HALF_H;
  }

  pointerDown(x: number, y: number): boolean {
    if (!this.contains(x, y)) return false;
    this.dragging = true;
    this.dragOffset.set(x - this.pos.x, y - this.pos.y);
    return true;
  }

  pointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const margin = 0.05;
    this.targetPos.set(
      THREE.MathUtils.clamp(x - this.dragOffset.x, -this.extentX + HALF_W + margin, this.extentX - HALF_W - margin),
      THREE.MathUtils.clamp(y - this.dragOffset.y, -this.extentY + HALF_H + margin, this.extentY - HALF_H - margin),
    );
  }

  pointerUp(): void {
    this.dragging = false;
    this.targetPos.copy(this.pos);
  }

  update(dt: number, speed: number): void {
    this.time += dt * speed;
    this.uniforms.uTime.value = this.time;

    const safeDt = Math.max(dt, 1e-4);

    // Move the tank toward the drag target; derive velocity / acceleration.
    const follow = 1 - Math.exp(-safeDt * 18);
    const nx = this.pos.x + (this.targetPos.x - this.pos.x) * follow;
    const ny = this.pos.y + (this.targetPos.y - this.pos.y) * follow;
    const vx = (nx - this.pos.x) / safeDt;
    const vy = (ny - this.pos.y) / safeDt;
    const ax = (vx - this.prevVel.x) / safeDt;
    const ay = (vy - this.prevVel.y) / safeDt;
    this.pos.set(nx, ny);
    this.prevVel.set(vx, vy);

    const smooth = 1 - Math.exp(-safeDt * 10);
    this.accel.x += (THREE.MathUtils.clamp(ax, -40, 40) - this.accel.x) * smooth;
    this.accel.y += (THREE.MathUtils.clamp(ay, -40, 40) - this.accel.y) * smooth;

    this.simulate(Math.min(safeDt * speed, 0.05));
    this.uploadHeights();
  }

  private simulate(dt: number): void {
    // Surface tilts against horizontal acceleration (non-inertial frame).
    const tilt = THREE.MathUtils.clamp(-this.accel.x * 0.06, -0.45, 0.45);
    const splash = Math.min(Math.abs(this.accel.y) * 0.02, 0.5);

    const k = 20; // restore toward the tilted equilibrium
    const spread = 350; // neighbor coupling -> wave propagation
    const damp = Math.exp(-0.9 * dt);
    const sub = 4;
    const sdt = dt / sub;

    const h = this.heights;
    const v = this.velocities;

    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < COLUMNS; i++) {
        const left = h[i > 0 ? i - 1 : i];
        const right = h[i < COLUMNS - 1 ? i + 1 : i];
        const xn = i / (COLUMNS - 1) - 0.5;
        const target =
          tilt * xn * 2 +
          Math.sin(this.time * 1.1 + i * 0.25) * 0.001 +
          Math.sin(this.time * 1.7 + i * 0.11) * 0.0008;
        const a = -k * (h[i] - target) + spread * (left + right - 2 * h[i]);
        v[i] += a * sdt;
        v[i] += (hash01(i) - 0.5) * splash * sdt * 8;
        v[i] *= damp;
      }
      for (let i = 0; i < COLUMNS; i++) {
        h[i] = THREE.MathUtils.clamp(h[i] + v[i] * sdt, -0.45, 0.45);
      }
    }
  }

  private uploadHeights(): void {
    for (let i = 0; i < COLUMNS; i++) {
      const o = i * 4;
      this.heightData[o] = Math.round(THREE.MathUtils.clamp(this.heights[i] * 0.5 + 0.5, 0, 1) * 255);
      this.heightData[o + 1] = Math.round(THREE.MathUtils.clamp(Math.abs(this.velocities[i]) * 0.25, 0, 1) * 255);
      this.heightData[o + 2] = 0;
      this.heightData[o + 3] = 255;
    }
    this.heightTex.needsUpdate = true;
  }
}

function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}