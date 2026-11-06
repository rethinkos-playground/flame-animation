import * as THREE from 'three';
import { Flame } from './flame';
import { Sparks } from './sparks';
import { River } from './river';
import { WaterTank } from './tank';

// Keep picker hex values as-is in shaders (no linear conversion).
THREE.ColorManagement.enabled = false;

// --- Animation abstraction ---------------------------------------------

interface Animation {
  readonly root: THREE.Object3D;
  setColor(hex: string): void;
  setSize(value: number): void;
  resize(bufferWidth: number, bufferHeight: number, halfHeight: number): void;
  update(dt: number, speed: number): void;
  pointerDown?(x: number, y: number): boolean;
  pointerMove?(x: number, y: number): void;
  pointerUp?(): void;
  contains?(x: number, y: number): boolean;
}

class FlameAnimation implements Animation {
  readonly root = new THREE.Group();
  private readonly flame = new Flame();
  private readonly sparks = new Sparks(this.flame.uniforms.uColor.value);
  private time = 0;

  constructor() {
    this.root.add(this.flame.mesh, this.sparks.points);
  }

  setColor(hex: string): void {
    this.flame.setColor(hex);
    this.sparks.setColor(hex);
  }

  setSize(value: number): void {
    this.flame.setSize(value);
    this.sparks.setSize(value);
  }

  resize(bufferWidth: number, bufferHeight: number, halfHeight: number): void {
    this.flame.setResolution(bufferWidth, bufferHeight);
    this.sparks.setPointScale(bufferHeight, halfHeight);
  }

  update(dt: number, speed: number): void {
    this.time += dt * speed;
    this.flame.uniforms.uTime.value = this.time;
    this.sparks.update(dt, speed);
  }
}

class RiverAnimation implements Animation {
  readonly root: THREE.Object3D;
  private readonly river = new River();

  constructor() {
    this.root = this.river.mesh;
  }

  setColor(hex: string): void {
    this.river.setColor(hex);
  }

  setSize(value: number): void {
    this.river.setSize(value);
  }

  resize(bufferWidth: number, bufferHeight: number): void {
    this.river.setResolution(bufferWidth, bufferHeight);
  }

  update(dt: number, speed: number): void {
    this.river.update(dt, speed);
  }
}

class TankAnimation implements Animation {
  readonly root: THREE.Object3D;
  private readonly tank = new WaterTank();

  constructor() {
    this.root = this.tank.mesh;
  }

  setColor(hex: string): void {
    this.tank.setColor(hex);
  }

  setSize(value: number): void {
    this.tank.setSize(value);
  }

  resize(bufferWidth: number, bufferHeight: number): void {
    this.tank.setResolution(bufferWidth, bufferHeight);
  }

  update(dt: number, speed: number): void {
    this.tank.update(dt, speed);
  }

  pointerDown(x: number, y: number): boolean {
    return this.tank.pointerDown(x, y);
  }

  pointerMove(x: number, y: number): void {
    this.tank.pointerMove(x, y);
  }

  pointerUp(): void {
    this.tank.pointerUp();
  }

  contains(x: number, y: number): boolean {
    return this.tank.contains(x, y);
  }
}

// --- Tab configuration --------------------------------------------------

interface Preset {
  color: string;
  name: string;
}

interface ControlState {
  color: string;
  size: number;
  speed: number;
}

interface Range {
  min: number;
  max: number;
  step: number;
}

interface Tab {
  id: string;
  label: string;
  tagline: string;
  colorLabel: string;
  sizeLabel: string;
  speedLabel: string;
  presets: Preset[];
  size: Range;
  speed: Range;
  animation: Animation;
  scene: THREE.Scene;
  state: ControlState;
}

function makeTab(
  config: Omit<Tab, 'animation' | 'scene' | 'state'>,
  animation: Animation,
  defaults: ControlState,
): Tab {
  const scene = new THREE.Scene();
  scene.add(animation.root);
  const state = { ...defaults };
  animation.setColor(state.color);
  animation.setSize(state.size);
  return { ...config, animation, scene, state };
}

const tabs: Tab[] = [
  makeTab(
    {
      id: 'flame',
      label: 'Flame',
      tagline: 'Procedural flame · TypeScript + Three.js',
      colorLabel: 'Flame Color',
      sizeLabel: 'Flame Size',
      speedLabel: 'Burn Speed',
      presets: [
        { color: '#ff6a00', name: 'Orange' },
        { color: '#38b6ff', name: 'Blue' },
        { color: '#46ff9a', name: 'Green' },
        { color: '#b06bff', name: 'Purple' },
        { color: '#ff4f8b', name: 'Pink' },
      ],
      size: { min: 0.4, max: 2.2, step: 0.01 },
      speed: { min: 0.2, max: 3, step: 0.01 },
    },
    new FlameAnimation(),
    { color: '#ff6a00', size: 1, speed: 1 },
  ),
  makeTab(
    {
      id: 'river',
      label: 'River',
      tagline: 'Flowing river · TypeScript + Three.js',
      colorLabel: 'Water Color',
      sizeLabel: 'River Width',
      speedLabel: 'Flow Speed',
      presets: [
        { color: '#2f9bff', name: 'Blue' },
        { color: '#16c8c8', name: 'Teal' },
        { color: '#35d07f', name: 'Emerald' },
        { color: '#8a6bff', name: 'Violet' },
        { color: '#ff8a5c', name: 'Sunset' },
      ],
      size: { min: 0.5, max: 1.8, step: 0.01 },
      speed: { min: 0.2, max: 3, step: 0.01 },
    },
    new RiverAnimation(),
    { color: '#2f9bff', size: 1, speed: 1 },
  ),
  makeTab(
    {
      id: 'tank',
      label: 'Water Tank',
      tagline: 'Drag the tank · sloshing water simulation',
      colorLabel: 'Water Color',
      sizeLabel: 'Water Level',
      speedLabel: 'Wave Speed',
      presets: [
        { color: '#2f9bff', name: 'Blue' },
        { color: '#16c8c8', name: 'Teal' },
        { color: '#35d07f', name: 'Emerald' },
        { color: '#8a6bff', name: 'Violet' },
        { color: '#ff8a5c', name: 'Sunset' },
      ],
      size: { min: 0.2, max: 0.85, step: 0.01 },
      speed: { min: 0.2, max: 3, step: 0.01 },
    },
    new TankAnimation(),
    { color: '#2f9bff', size: 0.55, speed: 1 },
  ),
];

let activeTab = tabs[0];

// --- Renderer / camera --------------------------------------------------

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setClearColor(0x050505, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 5;

// --- UI -----------------------------------------------------------------

const tabsNav = document.querySelector<HTMLElement>('#tabs')!;
const panel = document.querySelector<HTMLElement>('#panel')!;
const titleName = document.querySelector<HTMLElement>('#title-name')!;
const titleTagline = document.querySelector<HTMLElement>('#title-tagline')!;

function renderTabs(): void {
  tabsNav.innerHTML = '';
  for (const tab of tabs) {
    const button = document.createElement('button');
    button.className = 'tab' + (tab === activeTab ? ' active' : '');
    button.textContent = tab.label;
    button.addEventListener('click', () => selectTab(tab));
    tabsNav.appendChild(button);
  }
}

function selectTab(tab: Tab): void {
  if (tab === activeTab) return;
  activeTab.animation.pointerUp?.();
  pointerDragging = false;
  canvas.style.cursor = 'default';
  activeTab = tab;
  renderTabs();
  renderPanel();
  titleName.textContent = tab.label;
  titleTagline.textContent = tab.tagline;
}

function renderPanel(): void {
  const tab = activeTab;
  const { state } = tab;

  const swatches = tab.presets
    .map(
      (p) =>
        `<button class="swatch${p.color.toLowerCase() === state.color.toLowerCase() ? ' active' : ''}" ` +
        `data-color="${p.color}" style="--c:${p.color}" title="${p.name}"></button>`,
    )
    .join('');

  panel.innerHTML = `
    <div class="panel-row">
      <label for="color">${tab.colorLabel}</label>
      <div class="color-line">
        <input type="color" id="color" value="${state.color}" />
        <div class="swatches">${swatches}</div>
      </div>
    </div>
    <div class="panel-row">
      <label for="size">${tab.sizeLabel} <span class="value" id="size-value">${state.size.toFixed(2)}</span></label>
      <input type="range" id="size" min="${tab.size.min}" max="${tab.size.max}" step="${tab.size.step}" value="${state.size}" />
    </div>
    <div class="panel-row">
      <label for="speed">${tab.speedLabel} <span class="value" id="speed-value">${state.speed.toFixed(2)}</span></label>
      <input type="range" id="speed" min="${tab.speed.min}" max="${tab.speed.max}" step="${tab.speed.step}" value="${state.speed}" />
    </div>
  `;

  const colorInput = panel.querySelector<HTMLInputElement>('#color')!;
  const sizeInput = panel.querySelector<HTMLInputElement>('#size')!;
  const speedInput = panel.querySelector<HTMLInputElement>('#speed')!;
  const sizeValue = panel.querySelector<HTMLElement>('#size-value')!;
  const speedValue = panel.querySelector<HTMLElement>('#speed-value')!;
  const swatchButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('.swatch'));

  const applyColor = (hex: string): void => {
    state.color = hex;
    tab.animation.setColor(hex);
    colorInput.value = hex;
    for (const swatch of swatchButtons) {
      swatch.classList.toggle('active', swatch.dataset.color?.toLowerCase() === hex.toLowerCase());
    }
  };

  colorInput.addEventListener('input', () => applyColor(colorInput.value));
  for (const swatch of swatchButtons) {
    swatch.addEventListener('click', () => applyColor(swatch.dataset.color!));
  }

  sizeInput.addEventListener('input', () => {
    state.size = Number(sizeInput.value);
    tab.animation.setSize(state.size);
    sizeValue.textContent = state.size.toFixed(2);
  });

  speedInput.addEventListener('input', () => {
    state.speed = Number(speedInput.value);
    speedValue.textContent = state.speed.toFixed(2);
  });
}

renderTabs();
renderPanel();
titleName.textContent = activeTab.label;
titleTagline.textContent = activeTab.tagline;

// --- Pointer interaction (draggable tank) ------------------------------

let pointerDragging = false;

function toUV(event: PointerEvent): { x: number; y: number } {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const m = Math.min(width, height);
  return {
    x: (2 * event.clientX - width) / m,
    y: (height - 2 * event.clientY) / m,
  };
}

canvas.addEventListener('pointerdown', (event) => {
  const { x, y } = toUV(event);
  if (activeTab.animation.pointerDown?.(x, y)) {
    pointerDragging = true;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }
});

canvas.addEventListener('pointermove', (event) => {
  const { x, y } = toUV(event);
  if (pointerDragging) {
    activeTab.animation.pointerMove?.(x, y);
  } else {
    canvas.style.cursor = activeTab.animation.contains?.(x, y) ? 'grab' : 'default';
  }
});

function endDrag(): void {
  if (!pointerDragging) return;
  pointerDragging = false;
  activeTab.animation.pointerUp?.();
  canvas.style.cursor = 'default';
}

canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- Resize / render loop ----------------------------------------------

function resize(): void {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height);

  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());

  // Match the shaders' coordinate mapping: uv = (2*frag - res) / min(res).
  const halfHeight = height / Math.min(width, height);
  const halfWidth = width / Math.min(width, height);
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();

  for (const tab of tabs) {
    tab.animation.resize(buffer.x, buffer.y, halfHeight);
  }
}

window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  activeTab.animation.update(dt, activeTab.state.speed);
  renderer.render(activeTab.scene, camera);
});