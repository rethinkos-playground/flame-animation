import * as THREE from 'three';

// Tank dimensions (world units).
const TANK_W = 2.4;
const TANK_H = 1.6;
const TANK_D = 1.4;
const GLASS = 0.05;
const INNER_W = TANK_W - GLASS * 2;
const INNER_D = TANK_D - GLASS * 2;
const INNER_H = TANK_H - GLASS;
const SEG = 44; // water surface grid resolution
const DRAG_BOUND = 1.8;

// ColorManagement is enabled, so sRGB hex values are converted to linear automatically.
function linear(hex: string | number): THREE.Color {
  return new THREE.Color(hex);
}

export class WaterTank {
  readonly root = new THREE.Group(); // movable tank assembly
  readonly static = new THREE.Group(); // ground + lights
  readonly camera: THREE.PerspectiveCamera;

  private readonly glassMaterial: THREE.MeshPhysicalMaterial;
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial;
  private readonly surfaceMaterial: THREE.MeshPhysicalMaterial;
  private readonly waterBody: THREE.Mesh;
  private readonly surface: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  private readonly surfaceGeometry: THREE.PlaneGeometry;

  private readonly heights = new Float32Array((SEG + 1) * (SEG + 1));
  private readonly velocities = new Float32Array((SEG + 1) * (SEG + 1));

  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly pointer = new THREE.Vector2();
  private readonly hitPoint = new THREE.Vector3();
  private readonly dragOffset = new THREE.Vector2();
  private readonly targetPos = new THREE.Vector2(0, 0);
  private readonly prevVel = new THREE.Vector2();
  private readonly accel = new THREE.Vector2();
  private dragging = false;

  private fill = 0.55;
  private time = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 3.6, 4.6);
    this.camera.lookAt(0, 0.6, 0);

    // --- Glass walls (open top) ---
    // Reflection-only alpha blend: a transmissive material here would sample the
    // transmission buffer (opaque objects only) and hide the water behind it.
    this.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: linear(0x000000),
      metalness: 0,
      roughness: 0.04,
      ior: 1.5,
      envMapIntensity: 0.8,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });

    const panels: Array<[number, number, number, number, number, number]> = [
      // width, height, depth, x, y, z
      [TANK_W, GLASS, TANK_D, 0, GLASS / 2, 0], // bottom
      [GLASS, TANK_H, TANK_D, -TANK_W / 2 + GLASS / 2, TANK_H / 2, 0], // left
      [GLASS, TANK_H, TANK_D, TANK_W / 2 - GLASS / 2, TANK_H / 2, 0], // right
      [TANK_W, TANK_H, GLASS, 0, TANK_H / 2, TANK_D / 2 - GLASS / 2], // front
      [TANK_W, TANK_H, GLASS, 0, TANK_H / 2, -TANK_D / 2 + GLASS / 2], // back
    ];
    for (const [w, h, d, x, y, z] of panels) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.glassMaterial);
      mesh.position.set(x, y, z);
      this.root.add(mesh);
    }

    // --- Water volume (absorption / depth color) ---
    // Refractive volume: samples the opaque pass (tank floor) and absorbs light
    // with depth, which is what gives real water its saturated blue body.
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: linear(0x2f9bff),
      metalness: 0,
      roughness: 0.1,
      transmission: 0.75,
      ior: 1.33,
      thickness: 0.9,
      attenuationColor: linear(0x1a7fc0),
      attenuationDistance: 1.6,
      envMapIntensity: 0.3,
    });
    this.waterBody = new THREE.Mesh(new THREE.BoxGeometry(INNER_W, 1, INNER_D), this.bodyMaterial);
    this.waterBody.castShadow = true;
    this.root.add(this.waterBody);

    // Pool-tone tank floor: bright enough to refract, not so bright it washes the water out.
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(INNER_W, 0.02, INNER_D),
      new THREE.MeshStandardMaterial({ color: linear(0x6f9cb8), roughness: 0.55, metalness: 0 }),
    );
    floor.position.y = GLASS + 0.011;
    floor.receiveShadow = true;
    this.root.add(floor);

    // --- Water surface (simulated heightfield) ---
    this.surfaceGeometry = new THREE.PlaneGeometry(INNER_W, INNER_D, SEG, SEG);
    this.surfaceGeometry.rotateX(-Math.PI / 2);
    // Reflection-only sheen over the volume: wave normals catch env + key glints.
    this.surfaceMaterial = new THREE.MeshPhysicalMaterial({
      color: linear(0x000000),
      metalness: 0,
      roughness: 0.03,
      ior: 1.33,
      envMapIntensity: 1.2,
      clearcoat: 0.5,
      clearcoatRoughness: 0.03,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.surface = new THREE.Mesh(this.surfaceGeometry, this.surfaceMaterial);
    this.root.add(this.surface);

    this.applyFill();

    // --- Static environment: ground + lights ---
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: linear(0x333c46), roughness: 0.92, metalness: 0 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.static.add(ground);

    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.bias = -0.0004;
    this.static.add(key, key.target);

    const fill = new THREE.HemisphereLight(0x9db4cc, 0x1a2230, 0.5);
    this.static.add(fill);
  }

  setColor(hex: string): void {
    const base = linear(hex);
    const white = new THREE.Color(1, 1, 1);
    this.bodyMaterial.color.copy(base).lerp(white, 0.05);
    this.bodyMaterial.attenuationColor.copy(base).multiplyScalar(0.85);
  }

  setSize(fill: number): void {
    this.fill = fill;
    this.applyFill();
  }

  private applyFill(): void {
    const waterTop = GLASS + this.fill * INNER_H;
    const bodyHeight = Math.max(waterTop - GLASS - 0.02, 0.02);
    this.waterBody.scale.y = bodyHeight;
    this.waterBody.position.y = GLASS + bodyHeight / 2;
    this.surface.position.y = waterTop;
  }

  resize(bufferWidth: number, bufferHeight: number): void {
    this.camera.aspect = bufferWidth / bufferHeight;
    this.camera.updateProjectionMatrix();
  }

  // --- Pointer interaction (NDC coordinates) ---

  private setPointer(x: number, y: number): void {
    this.pointer.set(x, y);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  contains(x: number, y: number): boolean {
    this.setPointer(x, y);
    return this.raycaster.intersectObjects(this.root.children, false).length > 0;
  }

  pointerDown(x: number, y: number): boolean {
    this.setPointer(x, y);
    if (this.raycaster.intersectObjects(this.root.children, false).length === 0) return false;
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      this.dragOffset.set(this.hitPoint.x - this.root.position.x, this.hitPoint.z - this.root.position.z);
      this.dragging = true;
      return true;
    }
    return false;
  }

  pointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    this.setPointer(x, y);
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.hitPoint)) {
      this.targetPos.set(
        THREE.MathUtils.clamp(this.hitPoint.x - this.dragOffset.x, -DRAG_BOUND, DRAG_BOUND),
        THREE.MathUtils.clamp(this.hitPoint.z - this.dragOffset.y, -DRAG_BOUND, DRAG_BOUND),
      );
    }
  }

  pointerUp(): void {
    this.dragging = false;
    this.targetPos.set(this.root.position.x, this.root.position.z);
  }

  // --- Simulation ---

  update(dt: number, speed: number): void {
    this.time += dt * speed;
    const safeDt = Math.max(dt, 1e-4);

    // Move the tank toward the drag target; derive velocity / acceleration.
    const follow = 1 - Math.exp(-safeDt * 16);
    const nx = this.root.position.x + (this.targetPos.x - this.root.position.x) * follow;
    const nz = this.root.position.z + (this.targetPos.y - this.root.position.z) * follow;
    const vx = (nx - this.root.position.x) / safeDt;
    const vz = (nz - this.root.position.z) / safeDt;
    const ax = (vx - this.prevVel.x) / safeDt;
    const az = (vz - this.prevVel.y) / safeDt;
    this.root.position.set(nx, 0, nz);
    this.prevVel.set(vx, vz);

    const smooth = 1 - Math.exp(-safeDt * 9);
    this.accel.x += (THREE.MathUtils.clamp(ax, -50, 50) - this.accel.x) * smooth;
    this.accel.y += (THREE.MathUtils.clamp(az, -50, 50) - this.accel.y) * smooth;

    this.simulate(Math.min(safeDt * speed, 0.05));
    this.updateSurface();
  }

  private simulate(dt: number): void {
    const tiltX = THREE.MathUtils.clamp(-this.accel.x * 0.05, -0.4, 0.4);
    const tiltZ = THREE.MathUtils.clamp(-this.accel.y * 0.05, -0.4, 0.4);

    const k = 22; // restore toward tilted equilibrium
    const spread = 260; // 2D neighbor coupling -> wave propagation
    const damp = Math.exp(-0.8 * dt);
    const sub = 4;
    const sdt = dt / sub;
    const n = SEG + 1;
    const h = this.heights;
    const v = this.velocities;

    for (let s = 0; s < sub; s++) {
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const idx = j * n + i;
          const left = h[j * n + (i > 0 ? i - 1 : i)];
          const right = h[j * n + (i < n - 1 ? i + 1 : i)];
          const up = h[(j > 0 ? j - 1 : j) * n + i];
          const down = h[(j < n - 1 ? j + 1 : j) * n + i];
          const xn = i / SEG - 0.5;
          const zn = j / SEG - 0.5;
          const target =
            tiltX * xn * 2 +
            tiltZ * zn * 2 +
            Math.sin(this.time * 1.3 + i * 0.4 + j * 0.2) * 0.004 +
            Math.sin(this.time * 2.1 + i * 0.9 - j * 0.7) * 0.0025;
          const a = -k * (h[idx] - target) + spread * (left + right + up + down - 4 * h[idx]);
          v[idx] += a * sdt;
          v[idx] *= damp;
        }
      }
      for (let idx = 0; idx < h.length; idx++) {
        h[idx] = THREE.MathUtils.clamp(h[idx] + v[idx] * sdt, -0.35, 0.35);
      }
    }
  }

  private updateSurface(): void {
    const position = this.surfaceGeometry.attributes.position as THREE.BufferAttribute;
    const tm = this.time;
    for (let idx = 0; idx < this.heights.length; idx++) {
      const x = position.getX(idx);
      const z = position.getZ(idx);
      // Phase-modulated multi-directional micro-ripples: break the env reflection
      // into organic glints so the surface reads as moving water, not a mirror.
      const ripple =
        0.006 *
        (Math.sin(x * 16 + tm * 2.6 + Math.sin(z * 7 + tm * 1.3)) +
          0.7 * Math.sin(z * 19 - tm * 2.1 + Math.sin(x * 9 - tm * 0.7)) +
          0.5 * Math.sin((x + z) * 13 + tm * 1.7));
      position.setY(idx, this.heights[idx] + ripple);
    }
    position.needsUpdate = true;
    this.surfaceGeometry.computeVertexNormals();
  }
}