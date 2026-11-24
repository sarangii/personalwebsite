import * as THREE from "three";

/** Fine stripe texture: laminations on steel, turns on copper. */
function stripes(count: number, vertical: boolean, base: number, spread: number, groove = 70) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const step = size / count;
  for (let i = 0; i < count; i++) {
    const l = Math.round(base + (Math.random() - 0.5) * spread);
    g.fillStyle = `rgb(${l},${l},${l})`;
    if (vertical) g.fillRect(i * step, 0, step, size);
    else g.fillRect(0, i * step, size, step);
    g.fillStyle = `rgb(${base - groove},${base - groove},${base - groove})`;
    if (vertical) g.fillRect(i * step, 0, 1, size);
    else g.fillRect(0, i * step, size, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function createMaterials() {
  const lamV = stripes(96, true, 215, 40);
  const lamH = stripes(96, false, 215, 40);
  const turns = stripes(120, false, 238, 18, 38);
  turns.repeat.set(1, 2);
  const steel = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({ color: "#d6d9db", metalness: 0.8, roughness: 0.34, map, bumpMap: map, bumpScale: 0.6 });
  return {
    steelV: steel(lamV),
    steelH: steel(lamH),
    copper: new THREE.MeshStandardMaterial({ color: "#c98352", metalness: 0.92, roughness: 0.34, map: turns, bumpMap: turns, bumpScale: 0.5 }),
    pressboard: new THREE.MeshStandardMaterial({ color: "#cfb48a", metalness: 0, roughness: 0.85 }),
    clamp: new THREE.MeshStandardMaterial({ color: "#1E293B", metalness: 0.55, roughness: 0.42 }),
    paint: new THREE.MeshStandardMaterial({ color: "#aebcc8", metalness: 0.25, roughness: 0.48 }),
    paintDark: new THREE.MeshStandardMaterial({ color: "#8d9fae", metalness: 0.3, roughness: 0.5 }),
    oil: new THREE.MeshStandardMaterial({ color: "#d3a443", metalness: 0, roughness: 0.08, transparent: true, opacity: 0.2, depthWrite: false }),
    porcelain: new THREE.MeshStandardMaterial({ color: "#3d2219", metalness: 0.05, roughness: 0.16 }),
    brass: new THREE.MeshStandardMaterial({ color: "#c9a24c", metalness: 1, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: "#1b1d1e", metalness: 0, roughness: 0.7 }),
  };
}
export type Materials = ReturnType<typeof createMaterials>;
