import * as THREE from 'three';

const COUNT = 130;
const BASE_Y = -0.78;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  uniform float uPointScale;
  varying float vAlpha;

  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPointScale;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vAlpha;
    gl_FragColor = vec4((uColor + vec3(0.25)) * a, a);
    #include <colorspace_fragment>
  }
`;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  seed: number;
}

export class Sparks {
  readonly points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly sparks: Spark[] = [];
  private readonly positions: Float32Array;
  private readonly sizes: Float32Array;
  private readonly alphas: Float32Array;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private size = 1;
  private elapsed = 0;

  constructor(color: THREE.Color) {
    this.positions = new Float32Array(COUNT * 3);
    this.sizes = new Float32Array(COUNT);
    this.alphas = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      const spark = this.spawn(true);
      this.sparks.push(spark);
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: color.clone() },
        uPointScale: { value: 100 },
      },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setColor(hex: string): void {
    (this.material.uniforms.uColor.value as THREE.Color).set(hex);
  }

  setSize(size: number): void {
    this.size = size;
  }

  setPointScale(heightPx: number, halfHeight: number): void {
    this.material.uniforms.uPointScale.value = heightPx / (2 * halfHeight);
  }

  update(dt: number, speed: number): void {
    this.elapsed += dt * speed;
    const step = dt * speed;

    for (let i = 0; i < COUNT; i++) {
      let s = this.sparks[i];
      s.life -= step;
      if (s.life <= 0) {
        s = this.spawn(false);
        this.sparks[i] = s;
      }

      s.y += s.vy * step;
      s.x += (s.vx + Math.sin(this.elapsed * 2.5 + s.seed) * 0.12) * step;

      const t = s.life / s.maxLife; // 1 -> 0
      const alpha = Math.sin(Math.PI * Math.min(t * 1.15, 1)) * 0.85;

      this.positions[i * 3] = s.x;
      this.positions[i * 3 + 1] = s.y;
      this.positions[i * 3 + 2] = 0;
      this.sizes[i] = s.size * this.size;
      this.alphas[i] = alpha;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  private spawn(randomAge: boolean): Spark {
    const maxLife = 1.2 + Math.random() * 1.8;
    const life = randomAge ? Math.random() * maxLife : maxLife;
    const progress = 1 - life / maxLife;
    return {
      x: (Math.random() - 0.5) * 0.55 * this.size,
      y: BASE_Y + progress * 1.5 * this.size + Math.random() * 0.1,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (0.45 + Math.random() * 0.6) * this.size,
      life,
      maxLife,
      size: 0.008 + Math.random() * 0.02,
      seed: Math.random() * Math.PI * 2,
    };
  }
}