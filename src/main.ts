import * as THREE from 'three';
import { Flame } from './flame';
import { Sparks } from './sparks';

// Keep picker hex values as-is in shaders (no linear conversion).
THREE.ColorManagement.enabled = false;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x050505, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 5;

const flame = new Flame();
scene.add(flame.mesh);

const sparks = new Sparks(flame.uniforms.uColor.value);
scene.add(sparks.points);

// --- Controls -----------------------------------------------------------

const colorInput = document.querySelector<HTMLInputElement>('#color')!;
const sizeInput = document.querySelector<HTMLInputElement>('#size')!;
const speedInput = document.querySelector<HTMLInputElement>('#speed')!;
const sizeValue = document.querySelector<HTMLElement>('#size-value')!;
const speedValue = document.querySelector<HTMLElement>('#speed-value')!;
const swatches = Array.from(document.querySelectorAll<HTMLButtonElement>('.swatch'));

let speed = Number(speedInput.value);

function applyColor(hex: string): void {
  flame.setColor(hex);
  sparks.setColor(hex);
  colorInput.value = hex;
  for (const swatch of swatches) {
    swatch.classList.toggle('active', swatch.dataset.color?.toLowerCase() === hex.toLowerCase());
  }
}

colorInput.addEventListener('input', () => applyColor(colorInput.value));

for (const swatch of swatches) {
  swatch.addEventListener('click', () => applyColor(swatch.dataset.color!));
}

sizeInput.addEventListener('input', () => {
  const size = Number(sizeInput.value);
  flame.setSize(size);
  sparks.setSize(size);
  sizeValue.textContent = size.toFixed(2);
});

speedInput.addEventListener('input', () => {
  speed = Number(speedInput.value);
  speedValue.textContent = speed.toFixed(2);
});

// --- Resize / render loop ----------------------------------------------

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);

  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
  flame.setResolution(buffer.x, buffer.y);

  // Match the shader's coordinate mapping: uv = (2*frag - res) / min(res).
  const halfHeight = height / Math.min(width, height);
  const halfWidth = width / Math.min(width, height);
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  sparks.setPointScale(buffer.y, halfHeight);
}

window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let time = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt * speed;

  flame.uniforms.uTime.value = time;
  sparks.update(dt, speed);
  renderer.render(scene, camera);
});